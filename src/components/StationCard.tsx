import { Users, TrendingUp, Clock, Globe, Instagram, Facebook, Twitter, Youtube, Play, Square } from "lucide-react";
import { StationStatus } from "@/hooks/useStationMonitor";
import { Button } from "@/components/ui/button";
import { SocialLinks } from "@/data/stations";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

interface Props {
  status: StationStatus;
  onReport: () => void;
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

export function StationCard({ status, onReport }: Props) {
  const { station, online, listeners, lastChecked, source } = status;
  const { playingStationId, play } = useAudioPlayer();
  const isPlaying = playingStationId === station.id;

  return (
    <div className={`relative group rounded-xl border bg-card p-5 transition-all hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.25)] ${
      isPlaying ? "border-primary shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]" : "border-border hover:border-primary/40"
    }`}>
      {/* Live dot */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {source === 'real' && online && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400 ring-1 ring-red-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            Ao Vivo
          </span>
        )}
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            online ? "bg-online animate-pulse" : "bg-offline"
          }`}
        />
        <span className="text-xs font-mono text-muted-foreground">
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>

      {/* Station info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-lg bg-secondary overflow-hidden shrink-0">
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
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-foreground leading-tight text-sm">
            {station.name}
          </h3>
          <p className="text-xs font-mono text-muted-foreground">
            {station.frequency}
          </p>
        </div>
      </div>

      {/* Social links + Play */}
      <div className="flex items-center justify-between mb-3">
        <SocialIcons social={station.social} />
        <Button
          size="sm"
          variant={isPlaying ? "default" : "outline"}
          className={`h-8 w-8 p-0 rounded-full ${
            isPlaying
              ? "bg-primary text-primary-foreground"
              : "border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
          }`}
          onClick={() => play(station.id, station.streamUrl)}
          disabled={!online}
        >
          {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[11px] uppercase tracking-wide">Conexões</span>
          </div>
          <p className="font-mono font-bold text-lg text-foreground">
            {online ? listeners.toLocaleString("pt-BR") : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[11px] uppercase tracking-wide">Pico</span>
          </div>
          <p className="font-mono font-bold text-lg text-accent">
            {status.peakListeners.toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {lastChecked.toLocaleTimeString("pt-BR")}
        </span>
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
