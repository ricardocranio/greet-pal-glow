import { useState, useEffect, useCallback, useMemo } from "react";
import { getBrasiliaHour } from "@/lib/brasiliaTime";
import { Station, DbStation, dbToStation, fallbackStations, getDefaultVisibleStations } from "@/data/stations";
import { supabase } from "@/integrations/supabase/client";

export interface StationStatus {
  station: Station;
  online: boolean;
  listeners: number;
  peakListeners: number;
  peakTime: string;
  lastChecked: Date;
  history: { time: string; listeners: number }[];
  title?: string;
  bitrate?: number;
  source: 'real' | 'simulated';
}

interface StreamResult {
  id: string;
  online: boolean;
  listeners: number;
  peakListeners: number;
  title: string;
  bitrate: number;
  error?: string;
}

export function useStationMonitor() {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsLoaded, setStationsLoaded] = useState(false);
  const [statuses, setStatuses] = useState<StationStatus[]>([]);

  // Filter controls
  const [visibleStations, setVisibleStations] = useState<Set<string>>(new Set());
  const [showReligious, setShowReligious] = useState(false);
  const [showState, setShowState] = useState(false);
  const [simulatorEnabled, setSimulatorEnabled] = useState(false);
  const [simulatorFactor, setSimulatorFactor] = useState(75);

  // Praça filter
  const [activePracaId, setActivePracaId] = useState<string | null>(() => {
    const pracasJson = sessionStorage.getItem("auth_pracas");
    if (pracasJson) {
      const userPracas = JSON.parse(pracasJson);
      if (userPracas.length > 0) return userPracas[0].id;
    }
    return null;
  });

  // 1. Load stations from DB (filtered by praça if viewer)
  useEffect(() => {
    let cancelled = false;
    async function loadStations() {
      try {
        setStationsLoaded(false);
        // Get user praças from session
        const pracasJson = sessionStorage.getItem("auth_pracas");
        const userPracas: { id: string; name: string; state: string }[] = pracasJson ? JSON.parse(pracasJson) : [];
        const role = sessionStorage.getItem("auth_role") || "viewer";

        // Set initial active praça if not set
        let currentActiveId = activePracaId;
        if (userPracas.length > 0 && !currentActiveId) {
          currentActiveId = userPracas[0].id;
          setActivePracaId(currentActiveId);
        }

        let query = supabase
          .from("stations")
          .select("id, name, frequency, stream_url, logo_url, category, display_order, active, praca_id")
          .eq("active", true)
          .order("display_order", { ascending: true });

        // Strictly filter by praça. 
        const filterPracaId = currentActiveId || (userPracas.length > 0 ? userPracas[0].id : null);
        
        if (filterPracaId) {
          query = query.eq("praca_id", filterPracaId);
        } else if (role !== "admin") {
          // If not admin and no praça, force a filter that returns nothing
          query = query.eq("praca_id", "00000000-0000-0000-0000-000000000000");
        }

        const { data, error } = await query;

        if (error || !data || data.length === 0) {
          console.warn("Failed to load stations from DB, using fallback", error);
          if (!cancelled) {
            setStations(fallbackStations);
            setVisibleStations(new Set(getDefaultVisibleStations(fallbackStations)));
            setStatuses(fallbackStations.map(s => makeEmptyStatus(s)));
            setStationsLoaded(true);
          }
          return;
        }

        const loaded = (data as DbStation[]).map(dbToStation);
        if (!cancelled) {
          setStations(loaded);
          // Always reset visible stations when market/stations change
          setVisibleStations(new Set(getDefaultVisibleStations(loaded)));
          setStatuses(loaded.map(s => makeEmptyStatus(s)));
          setStationsLoaded(true);
        }
      } catch (err) {
        console.error("Error loading stations:", err);
        if (!cancelled) {
          setStations(fallbackStations);
          setVisibleStations(new Set(getDefaultVisibleStations(fallbackStations)));
          setStatuses(fallbackStations.map(s => makeEmptyStatus(s)));
          setStationsLoaded(true);
        }
      }
    }
    loadStations();
    return () => { cancelled = true; };
  }, [activePracaId]);

  const applyResult = useCallback((real: StreamResult) => {
    setStatuses((prev) =>
      prev.map((s) => {
        if (s.station.id !== real.id) return s;
        const now = new Date();
        const currentHour = getBrasiliaHour(now);
        const currentMinute = now.getMinutes();
        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        const newHistory = [...s.history, { time: timeStr, listeners: real.listeners }].slice(-24);
        const newPeak = real.listeners > s.peakListeners ? real.listeners : s.peakListeners;
        const newPeakTime = real.listeners > s.peakListeners ? timeStr : s.peakTime;
        const serverPeak = real.peakListeners > newPeak ? real.peakListeners : newPeak;
        return {
          ...s,
          online: real.online,
          listeners: real.online ? real.listeners : 0,
          peakListeners: serverPeak,
          peakTime: real.peakListeners > newPeak ? "server" : newPeakTime,
          lastChecked: now,
          history: newHistory,
          title: real.title || s.title,
          bitrate: real.bitrate || s.bitrate,
          source: 'real' as const,
        };
      })
    );
  }, []);

  const fetchRealData = useCallback(async () => {
    try {
      const { data: rows } = await supabase
        .from('current_status')
        .select('station_id, online, listeners, peak_listeners, title, bitrate');

      if (rows && rows.length > 0) {
        rows.forEach(r => applyResult({
          id: r.station_id,
          online: r.online,
          listeners: r.listeners,
          peakListeners: r.peak_listeners,
          title: r.title || '',
          bitrate: r.bitrate || 0,
        }));
      }

      supabase.functions.invoke('stream-status').catch(err => console.error('stream-status:', err));
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }, [applyResult]);

  useEffect(() => {
    if (!stationsLoaded) return;

    fetchRealData();
    const interval = setInterval(fetchRealData, 60000);

    const channel = supabase
      .channel('current_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'current_status' }, (payload) => {
        const r = payload.new as any;
        if (!r?.station_id) return;
        applyResult({
          id: r.station_id,
          online: r.online,
          listeners: r.listeners,
          peakListeners: r.peak_listeners,
          title: r.title || '',
          bitrate: r.bitrate || 0,
        });
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [stationsLoaded, fetchRealData, applyResult]);

  // Filtered statuses
  const filteredStatuses = useMemo(
    () => statuses.filter(s => {
      // Market filter (redundant but safe)
      if (activePracaId && s.station.pracaId && s.station.pracaId !== activePracaId) return false;
      
      if (s.station.category === 'religious' && !showReligious) return false;
      if (s.station.category === 'state' && !showState) return false;
      return visibleStations.has(s.station.id);
    }),
    [statuses, showReligious, showState, visibleStations, activePracaId]
  );

  // Apply simulator
  const displayStatuses = useMemo(
    () => simulatorEnabled
      ? filteredStatuses.map(s => ({
          ...s,
          listeners: Math.round(s.listeners * simulatorFactor),
          peakListeners: Math.round(s.peakListeners * simulatorFactor),
          history: s.history.map(h => ({ ...h, listeners: Math.round(h.listeners * simulatorFactor) })),
        }))
      : filteredStatuses,
    [filteredStatuses, simulatorEnabled, simulatorFactor]
  );

  const toggleStation = useCallback((id: string) => {
    setVisibleStations(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return {
    stations,
    statuses: displayStatuses,
    allStatuses: statuses,
    refresh: fetchRealData,
    visibleStations,
    toggleStation,
    showReligious,
    setShowReligious: (v: boolean) => {
      setShowReligious(v);
      setVisibleStations(prev => {
        const next = new Set(prev);
        stations.filter(s => s.category === 'religious').forEach(s => {
          if (v) next.add(s.id); else next.delete(s.id);
        });
        return next;
      });
    },
    showState,
    setShowState: (v: boolean) => {
      setShowState(v);
      setVisibleStations(prev => {
        const next = new Set(prev);
        stations.filter(s => s.category === 'state').forEach(s => {
          if (v) next.add(s.id); else next.delete(s.id);
        });
        return next;
      });
    },
    simulatorEnabled,
    setSimulatorEnabled,
    simulatorFactor,
    setSimulatorFactor,
    activePracaId,
    setActivePracaId,
    loading: !stationsLoaded,
  };
}

function makeEmptyStatus(station: Station): StationStatus {
  return {
    station,
    online: false,
    listeners: 0,
    peakListeners: 0,
    peakTime: "--:--",
    lastChecked: new Date(),
    history: [],
    source: 'simulated',
  };
}
