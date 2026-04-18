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

  const fetchRealData = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stream-status');

      if (error) {
        console.error('Edge function error:', error);
        return;
      }

      const results: StreamResult[] = data?.statuses ?? [];

      setStatuses((prev) =>
        prev.map((s) => {
          const real = results.find((r) => r.id === s.station.id);
          if (!real) return s;

          const now = new Date();
          const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

          const newHistory = [
            ...s.history,
            { time: timeStr, listeners: real.listeners },
          ].slice(-24);

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
    } catch (err) {
      console.error('Failed to fetch stream status:', err);
    }
  }, []);

  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 60000);
    return () => clearInterval(interval);
  }, [fetchRealData]);

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
