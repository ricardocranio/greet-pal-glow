import { useState, useEffect, useCallback } from "react";
import { stations, Station } from "@/data/stations";

export interface StationStatus {
  station: Station;
  online: boolean;
  listeners: number;
  peakListeners: number;
  peakTime: string;
  lastChecked: Date;
  history: { time: string; listeners: number }[];
}

function randomListeners(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateHistory() {
  const hours = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
  return hours.map((time) => ({ time, listeners: randomListeners(20, 800) }));
}

export function useStationMonitor() {
  const [statuses, setStatuses] = useState<StationStatus[]>(() =>
    stations.map((station) => {
      const history = generateHistory();
      const peak = history.reduce((max, h) => (h.listeners > max.listeners ? h : max), history[0]);
      return {
        station,
        online: Math.random() > 0.15,
        listeners: randomListeners(30, 500),
        peakListeners: peak.listeners,
        peakTime: peak.time,
        lastChecked: new Date(),
        history,
      };
    })
  );

  const refresh = useCallback(() => {
    setStatuses((prev) =>
      prev.map((s) => {
        const newListeners = Math.max(0, s.listeners + randomListeners(-40, 50));
        const isOnline = Math.random() > 0.1;
        const peak = newListeners > s.peakListeners ? newListeners : s.peakListeners;
        const peakTime = newListeners > s.peakListeners
          ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : s.peakTime;
        return {
          ...s,
          online: isOnline,
          listeners: isOnline ? newListeners : 0,
          peakListeners: peak,
          peakTime,
          lastChecked: new Date(),
        };
      })
    );
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { statuses, refresh };
}
