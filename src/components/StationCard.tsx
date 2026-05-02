import { memo } from "react";
import { Users, TrendingUp, Clock, Globe, Instagram, Facebook, Twitter, Youtube, Play, Square, Medal, Trophy, ExternalLink } from "lucide-react";
import { StationStatus } from "@/hooks/useStationMonitor";
import { Button } from "@/components/ui/button";
import { SocialLinks } from "@/data/stations";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

interface Props {
  status: StationStatus;
  onReport: () => void;
  rank?: number;
}

const SocialIcon = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
    {children}
  </a>
);

function SocialIcons({ social }: { social: SocialLinks }) {
  return (
    <div className="flex items-center gap-2">
      {social.website && <SocialIcon href={social.website}><Globe className="h-3.5 w-3.5" /></SocialIcon>}
      {social.instagram && <SocialIcon href={social.instagram}><Instagram className="h-3.5 w-3.5" /></SocialIcon>}
      {social.facebook && <SocialIcon href={social.facebook}><Facebook className="h-3.5 w-3.5" /></SocialIcon>}
      {social.twitter && <SocialIcon href={social.twitter}><Twitter className="h-3.5 w-3.5" /></SocialIcon>}
      {social.youtube && <SocialIcon href={social.youtube}><Youtube className="h-3.5 w-3.5" /></SocialIcon>}
    </div>
  );
}

function StationCardImpl({ status, onReport, rank }: Props) {
  const { station, online, listeners, lastChecked, source } = status;
  const { playingStationId, play } = useAudioPlayer();
  const isPlaying = playingStationId === station.id;

  const medalColor =
    rank === 1 ? "text-yellow-400 bg-yellow-400/10 ring-yellow-400/40"
    : rank === 2 ? "text-slate-300 bg-slate-300/10 ring-slate-300/40"
    : rank === 3 ? "text-amber-600 bg-amber-600/10 ring-amber-600/40"
    : "text-muted-foreground bg-muted/40 ring-border";

  return (
    <div className={`relative group rounded-xl border bg-card p-5 transition-all hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.25)] ${
      isPlaying ? "border-primary shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]" : "border-border hover:border-primary/40"
    }`}>
      {/* Rank badge */}
      {online && rank !== undefined && (
        <div className={`absolute -top-2 -left-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 shadow-sm ${medalColor}`}>
          {rank <= 3 ? <Trophy className="h-3 w-3" /> : <Medal className="h-3 w-3" />}
          <span className="font-mono tabular-nums">{rank}º</span>
        </div>
      )}
      {/* Live dot / status */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {online ? (
          <span
            className="h-2.5 w-2.5 rounded-full bg-online animate-pulse shadow-[0_0_8px_hsl(var(--online))]"
            aria-label="Online"
            title="Online"
          />
        ) : (
          <span
            className="flex items-center gap-1 rounded-full bg-offline/15 px-2 py-0.5 text-[10px] font-mono font-bold text-offline ring-1 ring-offline/40"
            title="Estação fora do ar"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-offline animate-pulse" />
            OFFLINE
          </span>
        )}
      </div>

      {/* Station info */}
      <div className="flex items-start gap-3 mb-3 pr-10">
        <div className="relative group/logo-container shrink-0">
          <button
            type="button"
            onClick={() => play(station.id, station.streamUrl)}
            aria-label={isPlaying ? `Parar ${station.name}` : `Tocar ${station.name}`}
            className={`group/logo relative flex h-12 w-12 items-center justify-center rounded-lg bg-secondary overflow-hidden transition-all cursor-pointer hover:ring-2 hover:ring-primary/60 ${
              isPlaying ? "ring-2 ring-primary" : ""
            } ${!online ? "opacity-70 grayscale-[0.5]" : ""}`}
            title={online ? "Clique para ouvir" : "Estação offline, mas você pode tentar conectar"}
          >
            {station.logoUrl ? (
              <img
                src={station.logoUrl}
                alt={station.name}
                className="h-10 w-10 object-contain"
                loading="lazy"
                width={40}
                height={40}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-sm font-bold text-muted-foreground">FM</span>
            )}
            <span className={`absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm transition-opacity ${
              isPlaying ? "opacity-100" : "opacity-0 group-hover/logo:opacity-100"
            }`}>
              {isPlaying ? <Square className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-primary ml-0.5" />}
            </span>
          </button>
          
          {/* External Link Overlay */}
          <a 
            href={station.streamUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full p-1 opacity-0 group-hover/logo-container:opacity-100 transition-opacity hover:text-primary shadow-sm"
            title="Abrir URL do stream diretamente"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-foreground leading-tight text-sm truncate">
            {station.name}
          </h3>
          <p className="text-xs font-mono text-muted-foreground">
            {station.frequency}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4">
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[11px] uppercase tracking-wide">Conexões</span>
          </div>
          <p className="font-mono font-bold text-lg text-foreground tabular-nums whitespace-nowrap">
            {online ? listeners.toLocaleString("pt-BR") : "—"}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-center">
        <Button
          size="sm"
          variant="outline"
          className="text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
          onClick={onReport}
        >
          Relatório
        </Button>
      </div>
    </div>
  );
}

// Re-render only when station status actually changes
export const StationCard = memo(StationCardImpl, (prev, next) => {
  return (
    prev.status.station.id === next.status.station.id &&
    prev.status.online === next.status.online &&
    prev.status.listeners === next.status.listeners &&
    prev.status.source === next.status.source &&
    prev.rank === next.rank &&
    prev.onReport === next.onReport
  );
});
