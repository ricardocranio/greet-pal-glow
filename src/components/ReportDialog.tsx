import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StationStatus } from "@/hooks/useStationMonitor";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, ReferenceArea,
} from "recharts";
import { TrendingUp, Clock, Users, Instagram, Calendar, CalendarDays, ZoomIn, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatBrasiliaDateInput, getBrasiliaDay } from "@/lib/brasiliaTime";

interface Props {
  status: StationStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewMode = "realtime" | "horario" | "dia" | "mes";
type ZoomInterval = 3 | 5;

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface SnapshotRow {
  listeners: number;
  hour: number;
  recorded_at: string;
}

export function ReportDialog({ status, open, onOpenChange }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("realtime");
  const [zoomInterval, setZoomInterval] = useState<ZoomInterval>(5);
  const [hourlyData, setHourlyData] = useState<{ time: string; listeners: number }[]>([]);
  const [dailyData, setDailyData] = useState<{ time: string; listeners: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ time: string; listeners: number }[]>([]);
  const [allSnapshots, setAllSnapshots] = useState<SnapshotRow[]>([]);

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
          setHourlyData(status.history);
          setDailyData([]);
          setMonthlyData([]);
          setAllSnapshots([]);
          return;
        }

        setAllSnapshots(data);

        const hourMap = new Map<number, number[]>();
        const dayMap = new Map<number, number[]>();
        const monthMap = new Map<string, { sum: number; count: number }>();

        data.forEach((snap) => {
          const h = snap.hour;
          if (!hourMap.has(h)) hourMap.set(h, []);
          hourMap.get(h)!.push(snap.listeners);

          const dt = new Date(new Date(snap.recorded_at).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
          const d = dt.getDay();
          if (!dayMap.has(d)) dayMap.set(d, []);
          dayMap.get(d)!.push(snap.listeners);

          const mKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
          if (!monthMap.has(mKey)) monthMap.set(mKey, { sum: 0, count: 0 });
          const m = monthMap.get(mKey)!;
          m.sum += snap.listeners;
          m.count += 1;
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

        const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const mData = sortedMonths.map(([key, { sum, count }]) => {
          const [, mm] = key.split("-");
          return { time: MONTH_NAMES[parseInt(mm, 10) - 1], listeners: Math.round(sum / count) };
        });

        setHourlyData(hData);
        setDailyData(dData);
        setMonthlyData(mData);
      });
  }, [open, status]);

  // Real-time chart: today's snapshots for this station, grouped by N-minute intervals
  const realtimeData = useMemo(() => {
    if (!status) return [];
    const todayStr = formatBrasiliaDateInput();
    const todaySnaps = allSnapshots.filter(
      (snap) => formatBrasiliaDateInput(new Date(snap.recorded_at)) === todayStr
    );

    const intervalMin = zoomInterval;
    const slots: { time: string; minuteOfDay: number; listeners?: number }[] = [];

    for (let m = 0; m < 24 * 60; m += intervalMin) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const label = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      slots.push({ time: label, minuteOfDay: m });
    }

    for (const slot of slots) {
      const slotStart = slot.minuteOfDay;
      const slotEnd = slotStart + intervalMin;

      const matching = todaySnaps.filter((snap) => {
        const d = new Date(snap.recorded_at);
        const brasiliaStr = d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const b = new Date(brasiliaStr);
        const snapMinute = b.getHours() * 60 + b.getMinutes();
        return snapMinute >= slotStart && snapMinute < slotEnd;
      });

      if (matching.length > 0) {
        slot.listeners = Math.round(matching.reduce((sum, s) => sum + s.listeners, 0) / matching.length);
      }
    }

    const now = new Date();
    const brasiliaStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const bNow = new Date(brasiliaStr);
    const currentMinute = bNow.getHours() * 60 + bNow.getMinutes();

    return slots.filter((slot) => {
      if (slot.minuteOfDay > currentMinute + intervalMin) return false;
      return slot.listeners !== undefined || slot.minuteOfDay <= currentMinute;
    });
  }, [allSnapshots, zoomInterval, status]);

  if (!status) return null;
  const { station, peakListeners, peakTime, listeners } = status;

  const chartData = viewMode === "horario" ? hourlyData : viewMode === "dia" ? dailyData : monthlyData;
  const dayName = DAY_SHORT[getBrasiliaDay()];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
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
            onClick={() => setViewMode("realtime")}
            className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-medium py-2 rounded-md transition-colors ${
              viewMode === "realtime"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="h-3 w-3" />
            Tempo Real
          </button>
          <button
            onClick={() => setViewMode("horario")}
            className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-medium py-2 rounded-md transition-colors ${
              viewMode === "horario"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3 w-3" />
            Horário
          </button>
          <button
            onClick={() => setViewMode("dia")}
            className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-medium py-2 rounded-md transition-colors ${
              viewMode === "dia"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3 w-3" />
            Dia
          </button>
          <button
            onClick={() => setViewMode("mes")}
            className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-medium py-2 rounded-md transition-colors ${
              viewMode === "mes"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-3 w-3" />
            Mês
          </button>
        </div>

        {/* Real-time chart */}
        {viewMode === "realtime" && (
          <div className="rounded-lg bg-secondary/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Audiência em Tempo Real — {dayName}
              </p>
            </div>

            {/* Zoom selector */}
            <div className="flex items-center gap-2 mb-3">
              <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Intervalo:</span>
              {([5, 3] as ZoomInterval[]).map((interval) => (
                <Button
                  key={interval}
                  size="sm"
                  variant={zoomInterval === interval ? "default" : "outline"}
                  className={`text-[10px] h-6 px-2 ${
                    zoomInterval === interval
                      ? "bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                  onClick={() => setZoomInterval(interval)}
                >
                  {interval} min
                </Button>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={realtimeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <ReferenceArea x1="00:00" x2="05:55" fill="hsl(var(--primary))" fillOpacity={0.08} />
                <ReferenceArea x1="22:00" x2="23:55" fill="hsl(var(--primary))" fillOpacity={0.08} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  interval={Math.floor(60 / zoomInterval) - 1}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                  formatter={(value: number) => [value?.toLocaleString("pt-BR") ?? "—", "Conexões"]}
                />
                <ReferenceLine x="22:00" stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine x="06:00" stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="listeners"
                  name="Conexões"
                  stroke="hsl(160 84% 44%)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>

            <div className="flex items-center gap-2 mt-2 justify-center">
              <div className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/30" />
              <span className="text-[10px] text-muted-foreground">🌙 Madrugada (22h–05h)</span>
            </div>
          </div>
        )}

        {/* Historical charts */}
        {viewMode !== "realtime" && (
          <div className="rounded-lg bg-secondary/30 p-4">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">
              {viewMode === "horario"
                ? "Audiência por Horário (07h - 22h)"
                : viewMode === "dia"
                ? "Audiência por Dia da Semana"
                : "Audiência Média por Mês"}
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
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-2">
          {viewMode === "realtime" ? "Dados de hoje • Atualização a cada 30s" : "Dados reais • Média dos últimos 90 dias"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
