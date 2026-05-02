import { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from "react";
import { toast } from "sonner";

interface AudioContextType {
  playingStationId: string | null;
  volume: number;
  error: string | null;
  play: (stationId: string, streamUrl: string) => void;
  stop: () => void;
  setVolume: (v: number) => void;
}

const AudioCtx = createContext<AudioContextType>({
  playingStationId: null,
  volume: 0.8,
  error: null,
  play: () => {},
  stop: () => {},
  setVolume: () => {},
});

// Try multiple stream URL variations for compatibility
function getStreamUrls(baseUrl: string): string[] {
  const urls = [baseUrl];
  
  // If HTTP, also try via HTTPS proxy patterns
  if (baseUrl.startsWith('http://')) {
    // Some streams work with /stream or /; suffix
    if (!baseUrl.endsWith('/')) urls.push(baseUrl + '/');
    if (!baseUrl.includes('/stream')) urls.push(baseUrl.replace(/\/?$/, '/stream'));
  }
  
  // Remove query params for cleaner URL
  const cleanUrl = baseUrl.split('?')[0];
  if (cleanUrl !== baseUrl) urls.push(cleanUrl);
  
  // Add /; for shoutcast compatibility
  if (!baseUrl.includes(';')) {
    urls.push(baseUrl.replace(/\/?$/, '/;'));
  }
  
  return [...new Set(urls)];
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [playingStationId, setPlayingStationId] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(0.8);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current = null;
    }
    setPlayingStationId(null);
    setError(null);
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
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }

    if (playingStationId === stationId) {
      audioRef.current = null;
      setPlayingStationId(null);
      setError(null);
      return;
    }

    setError(null);
    const urls = getStreamUrls(streamUrl);
    
    const tryPlay = (index: number) => {
      if (index >= urls.length) {
        const msg = "Não foi possível reproduzir o stream. Verifique se o navegador permite conteúdo misto (HTTP/HTTPS) ou tente o link direto.";
        setError(msg);
        toast.error(msg);
        setPlayingStationId(null);
        return;
      }

      const audio = new Audio();
      audio.volume = volume;
      audio.preload = 'none';
      
      audio.onerror = () => {
        console.warn(`Stream URL ${index + 1}/${urls.length} failed:`, urls[index]);
        tryPlay(index + 1);
      };

      audio.oncanplay = () => {
        audioRef.current = audio;
        setPlayingStationId(stationId);
      };

      audio.src = urls[index];
      audio.play().catch((err) => {
        console.warn("Erro ao reproduzir stream:", err.message);
        tryPlay(index + 1);
      });
    };

    tryPlay(0);
  }, [playingStationId, volume]);

  return (
    <AudioCtx.Provider value={{ playingStationId, volume, error, play, stop, setVolume }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudioPlayer() {
  return useContext(AudioCtx);
}
