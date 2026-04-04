import { useState, useEffect, useCallback } from "react";
import { stations, Station } from "@/data/stations";
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

          // Update history (keep last 24 entries = ~2 hours at 5min intervals)
          const newHistory = [
            ...s.history,
            { time: timeStr, listeners: real.listeners },
          ].slice(-24);

          const newPeak = real.listeners > s.peakListeners ? real.listeners : s.peakListeners;
          const newPeakTime = real.listeners > s.peakListeners ? timeStr : s.peakTime;

          // Also use server-reported peak if higher
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

  // Initial fetch + interval every 30 seconds
  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 30000);
    return () => clearInterval(interval);
  }, [fetchRealData]);

  return { statuses, refresh: fetchRealData };
}
