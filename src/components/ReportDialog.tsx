import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StationStatus } from "@/hooks/useStationMonitor";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Clock, Users, Instagram, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  status: StationStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewMode = "horario" | "dia";

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function ReportDialog({ status, open, onOpenChange }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("horario");
  const [hourlyData, setHourlyData] = useState<{ time: string; listeners: number }[]>([]);
  const [dailyData, setDailyData] = useState<{ time: string; listeners: number }[]>([]);

  useEffect(() => {
    if (!open || !status) return;

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("audience_snapshots")
      .select("listeners, hour, recorded_at")
      .eq("station_id", status.station.id)
      .gte("recorded_at", cutoff)
      .order("recorded_at", { ascending: true })
      .then(({ data }) => {
        if (!data || data.length === 0) {
          // Fallback to in-memory history
          setHourlyData(status.history);
          setDailyData([]);
          return;
        }

        // Group by hour (07-22)
        const hourMap = new Map<number, number[]>();
        const dayMap = new Map<number, number[]>();

        data.forEach((snap) => {
          const h = snap.hour;
          if (!hourMap.has(h)) hourMap.set(h, []);
          hourMap.get(h)!.push(snap.listeners);

          const d = new Date(new Date(snap.recorded_at).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
          if (!dayMap.has(d)) dayMap.set(d, []);
          dayMap.get(d)!.push(snap.listeners);
        });

        const hData = Array.from({ length: 16 }, (_, i) => i + 7).map((h) => {
          const vals = hourMap.get(h) || [];
          const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
          return { time: `${String(h).padStart(2, "0")}:00`, listeners: avg };
        });

        const dData = [0, 1, 2, 3, 4, 5, 6].map((d) => {
          const vals = dayMap.get(d) || [];
          const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
          return { time: DAY_NAMES[d], listeners: avg };
        });

        setHourlyData(hData);
        setDailyData(dData);
      });
  }, [open, status]);

  if (!status) return null;
  const { station, peakListeners, peakTime, listeners } = status;

  const chartData = viewMode === "horario" ? hourlyData : dailyData;

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

        {/* View mode tabs */}
        <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 mb-3">
          <button
            onClick={() => setViewMode("horario")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-2 rounded-md transition-colors ${
              viewMode === "horario"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Por Horário
          </button>
          <button
            onClick={() => setViewMode("dia")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-2 rounded-md transition-colors ${
              viewMode === "dia"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Por Dia
          </button>
        </div>

        {/* Chart */}
        <div className="rounded-lg bg-secondary/30 p-4">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">
            {viewMode === "horario" ? "Audiência por Horário (07h - 22h)" : "Audiência por Dia da Semana"}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
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
          Dados reais • Média dos últimos 90 dias
        </p>
      </DialogContent>
    </Dialog>
  );
}
