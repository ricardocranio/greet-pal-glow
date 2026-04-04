import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";

interface AudioContextType {
  playingStationId: string | null;
  play: (stationId: string, streamUrl: string) => void;
  stop: () => void;
}

const AudioCtx = createContext<AudioContextType>({
  playingStationId: null,
  play: () => {},
  stop: () => {},
});

export function AudioProvider({ children }: { children: ReactNode }) {
  const [playingStationId, setPlayingStationId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingStationId(null);
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
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlayingStationId(stationId);
  }, [playingStationId]);

  return (
    <AudioCtx.Provider value={{ playingStationId, play, stop }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudioPlayer() {
  return useContext(AudioCtx);
}
