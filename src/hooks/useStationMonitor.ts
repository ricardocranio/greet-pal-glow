import { useState, useEffect, useCallback, useMemo } from "react";
import { stations, Station, getDefaultVisibleStations } from "@/data/stations";
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
  const [statuses, setStatuses] = useState<StationStatus[]>(() =>
    stations.map((station) => ({
      station,
      online: false,
      listeners: 0,
      peakListeners: 0,
      peakTime: "--:--",
      lastChecked: new Date(),
      history: [],
      source: 'simulated' as const,
    }))
  );

  // Filter controls
  const [visibleStations, setVisibleStations] = useState<Set<string>>(() => new Set(getDefaultVisibleStations()));
  const [showReligious, setShowReligious] = useState(false);
  const [showState, setShowState] = useState(false);
  const [simulatorEnabled, setSimulatorEnabled] = useState(false);
  const [simulatorFactor, setSimulatorFactor] = useState(75);

  const applyResult = useCallback((real: StreamResult) => {
    setStatuses((prev) =>
      prev.map((s) => {
        if (s.station.id !== real.id) return s;
        const now = new Date();
        const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
      // 1. Fast path: read pre-computed current_status from DB (cached, no upstream calls)
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

      // 2. Trigger fresh fetch in background (updates current_status for everyone)
      supabase.functions.invoke('stream-status').catch(err => console.error('stream-status:', err));
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }, [applyResult]);

  useEffect(() => {
    fetchRealData();
    // Background refresh every 60s (was 30s) — Realtime handles instant updates
    const interval = setInterval(fetchRealData, 60000);

    // Realtime: push updates from current_status table
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
  }, [fetchRealData, applyResult]);

  // Filtered statuses based on visibility (memoized)
  const filteredStatuses = useMemo(
    () => statuses.filter(s => {
      if (s.station.category === 'religious' && !showReligious) return false;
      if (s.station.category === 'state' && !showState) return false;
      return visibleStations.has(s.station.id);
    }),
    [statuses, showReligious, showState, visibleStations]
  );

  // Apply simulator (memoized)
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
    statuses: displayStatuses,
    allStatuses: statuses,
    refresh: fetchRealData,
    visibleStations,
    toggleStation,
    showReligious,
    setShowReligious: (v: boolean) => {
      setShowReligious(v);
      // Auto-toggle visibility for religious stations
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
  };
}
