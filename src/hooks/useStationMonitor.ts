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

// Faixas realistas de ouvintes streaming por emissora em Natal/RN (~900K hab)
// Baseado em audiência proporcional ao mercado e popularidade de cada emissora
const STATION_PROFILES: Record<string, { min: number; max: number; peakMultiplier: number }> = {
  "98fm":      { min: 180, max: 420, peakMultiplier: 1.6 },   // Líder de audiência
  "96fm":      { min: 140, max: 350, peakMultiplier: 1.5 },   // Segunda maior
  "97fm":      { min: 100, max: 280, peakMultiplier: 1.4 },   // Forte audiência
  "jpnatal":   { min: 60,  max: 180, peakMultiplier: 1.5 },   // Jovem Pan FM
  "95fm":      { min: 40,  max: 130, peakMultiplier: 1.3 },   // Audiência média
  "jpnews":    { min: 35,  max: 110, peakMultiplier: 1.7 },   // Pico em horário de notícia
  "91fm":      { min: 25,  max: 90,  peakMultiplier: 1.3 },   // Rural
  "104fm":     { min: 20,  max: 75,  peakMultiplier: 1.2 },   // Audiência menor
  "clubefm":   { min: 15,  max: 60,  peakMultiplier: 1.3 },   // Audiência menor
  "mundialfm": { min: 10,  max: 45,  peakMultiplier: 1.2 },   // Menor audiência
};

// Horários com peso de audiência (manhã e noite são picos)
const HOUR_WEIGHTS: Record<string, number> = {
  "06:00": 0.5,
  "08:00": 0.85,
  "10:00": 0.95,
  "12:00": 1.0,    // Meio-dia = pico
  "14:00": 0.7,
  "16:00": 0.6,
  "18:00": 0.9,    // Volta pra casa
  "20:00": 0.75,
  "22:00": 0.4,
};

function randomInRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getProfile(stationId: string) {
  return STATION_PROFILES[stationId] || { min: 15, max: 50, peakMultiplier: 1.2 };
}

function generateHistory(stationId: string) {
  const profile = getProfile(stationId);
  const hours = Object.keys(HOUR_WEIGHTS);
  return hours.map((time) => {
    const weight = HOUR_WEIGHTS[time];
    const base = randomInRange(
      Math.round(profile.min * weight),
      Math.round(profile.max * weight * profile.peakMultiplier)
    );
    return { time, listeners: base };
  });
}

function getCurrentWeight(): number {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 8) return 0.5;
  if (hour >= 8 && hour < 10) return 0.85;
  if (hour >= 10 && hour < 12) return 0.95;
  if (hour >= 12 && hour < 14) return 1.0;
  if (hour >= 14 && hour < 16) return 0.7;
  if (hour >= 16 && hour < 18) return 0.6;
  if (hour >= 18 && hour < 20) return 0.9;
  if (hour >= 20 && hour < 22) return 0.75;
  return 0.35;
}

export function useStationMonitor() {
  const [statuses, setStatuses] = useState<StationStatus[]>(() =>
    stations.map((station) => {
      const profile = getProfile(station.id);
      const history = generateHistory(station.id);
      const peak = history.reduce((max, h) => (h.listeners > max.listeners ? h : max), history[0]);
      const weight = getCurrentWeight();
      const currentListeners = randomInRange(
        Math.round(profile.min * weight),
        Math.round(profile.max * weight)
      );
      return {
        station,
        online: Math.random() > 0.08,
        listeners: currentListeners,
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
        const profile = getProfile(s.station.id);
        const weight = getCurrentWeight();
        const isOnline = Math.random() > 0.05;
        // Variação suave: ±8% do valor atual, dentro dos limites do perfil
        const variation = Math.round(s.listeners * (Math.random() * 0.16 - 0.08));
        const minNow = Math.round(profile.min * weight);
        const maxNow = Math.round(profile.max * weight);
        const newListeners = Math.max(minNow, Math.min(maxNow, s.listeners + variation));
        
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
