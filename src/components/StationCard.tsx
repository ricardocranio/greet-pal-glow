import { Radio, Users, TrendingUp, Clock } from "lucide-react";
import { StationStatus } from "@/hooks/useStationMonitor";
import { Button } from "@/components/ui/button";

interface Props {
  status: StationStatus;
  onReport: () => void;
}

export function StationCard({ status, onReport }: Props) {
  const { station, online, listeners, lastChecked } = status;

  return (
    <div className="relative group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.25)]">
      {/* Live dot */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
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
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary overflow-hidden shrink-0">
          <img src={station.logo} alt={station.name} className="h-10 w-10 object-contain" loading="lazy" width={40} height={40} />
        </div>
        <div>
          <h3 className="font-display font-bold text-foreground leading-tight">
            {station.name}
          </h3>
          <p className="text-xs font-mono text-muted-foreground">
            {station.frequency}
          </p>
        </div>
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
