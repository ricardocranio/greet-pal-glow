import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";

interface AudioContextType {
  playingStationId: string | null;
  volume: number;
  play: (stationId: string, streamUrl: string) => void;
  stop: () => void;
  setVolume: (v: number) => void;
}

const AudioCtx = createContext<AudioContextType>({
  playingStationId: null,
  volume: 0.8,
  play: () => {},
  stop: () => {},
  setVolume: () => {},
});

export function AudioProvider({ children }: { children: ReactNode }) {
  const [playingStationId, setPlayingStationId] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingStationId(null);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  }, []);

  const play = useCallback((stationId: string, streamUrl: string) => {
    // Stop current
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    if (playingStationId === stationId) {
      audioRef.current = null;
      setPlayingStationId(null);
      return;
    }

    const audio = new Audio(streamUrl);
    audio.volume = volume;
    audio.play().catch((err) => {
      console.warn("Erro ao reproduzir stream:", err.message);
    });
    audioRef.current = audio;
    setPlayingStationId(stationId);
  }, [playingStationId, volume]);

  return (
    <AudioCtx.Provider value={{ playingStationId, volume, play, stop, setVolume }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudioPlayer() {
  return useContext(AudioCtx);
}
