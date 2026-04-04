import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StationStatus } from "@/hooks/useStationMonitor";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Clock, Users, Instagram } from "lucide-react";

interface Props {
  status: StationStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ status, open, onOpenChange }: Props) {
  if (!status) return null;

  const { station, peakListeners, peakTime, listeners, history } = status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-3 text-foreground">
            <img
              src={station.logoUrl}
              alt={station.name}
              className="h-10 w-10 object-contain rounded-lg bg-secondary p-1"
              width={40}
              height={40}
            />
            <div>
              <span>{station.name}</span>
              <span className="block text-sm font-mono text-muted-foreground font-normal">
                {station.frequency}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-[11px] text-muted-foreground uppercase">Conexões Agora</p>
            <p className="font-mono font-bold text-foreground">{listeners.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-accent" />
            <p className="text-[11px] text-muted-foreground uppercase">Pico</p>
            <p className="font-mono font-bold text-accent">{peakListeners.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground uppercase">Horário Pico</p>
            <p className="font-mono font-bold text-foreground">{peakTime}</p>
          </div>
          {station.instagramFollowers && (
            <a
              href={station.social.instagram || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-gradient-to-br from-[hsl(330,70%,40%)/0.2] to-[hsl(270,70%,40%)/0.2] p-3 text-center hover:from-[hsl(330,70%,40%)/0.3] hover:to-[hsl(270,70%,40%)/0.3] transition-colors"
            >
              <Instagram className="h-4 w-4 mx-auto mb-1 text-[hsl(330,70%,60%)]" />
              <p className="text-[11px] text-muted-foreground uppercase">Instagram</p>
              <p className="font-mono font-bold text-foreground">
                {station.instagramFollowers >= 1000
                  ? `${(station.instagramFollowers / 1000).toFixed(station.instagramFollowers >= 100000 ? 0 : 1)}K`
                  : station.instagramFollowers.toLocaleString("pt-BR")}
              </p>
              {station.instagramHandle && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{station.instagramHandle}</p>
              )}
            </a>
          )}
        </div>

        {/* Chart */}
        <div className="rounded-lg bg-secondary/30 p-4">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">
            Audiência por horário
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis
                dataKey="time"
                tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220 18% 12%)",
                  border: "1px solid hsl(220 14% 18%)",
                  borderRadius: "8px",
                  color: "hsl(210 20% 92%)",
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(210 20% 92%)" }}
              />
              <Bar
                dataKey="listeners"
                name="Conexões"
                fill="hsl(160 84% 44%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Dados simulados • Atualização a cada 5 segundos
        </p>
      </DialogContent>
    </Dialog>
  );
}
