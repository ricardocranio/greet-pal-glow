import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { TrendingUp, TrendingDown, Clock, Users, Calendar, CalendarDays, ZoomIn, Activity, Layers, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBrasiliaDateInput, getBrasiliaDay } from "@/lib/brasiliaTime";
import { stations } from "@/data/stations";
import { toPng } from "html-to-image";

interface Props {
  status: StationStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibleStations?: Set<string>;
  simulatorEnabled?: boolean;
  simulatorFactor?: number;
}

type ViewMode = "realtime" | "horario" | "dia" | "mes" | "blend";
type ZoomInterval = 3 | 5;
type BlendView = "horario" | "dia";

const STATION_COLORS = [
  "hsl(160 84% 44%)", "hsl(210 90% 55%)", "hsl(340 75% 55%)", "hsl(45 90% 50%)",
  "hsl(280 70% 55%)", "hsl(20 85% 55%)", "hsl(180 60% 45%)", "hsl(120 50% 45%)",
  "hsl(0 70% 55%)", "hsl(240 60% 60%)", "hsl(30 80% 50%)", "hsl(200 70% 50%)",
];

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface SnapshotRow {
  listeners: number;
  hour: number;
  recorded_at: string;
}

function getDateTimeStamp(): string {
  const now = new Date();
  const date = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const time = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time} (Brasília)`;
}

export function ReportDialog({ status, open, onOpenChange, visibleStations, simulatorEnabled = false, simulatorFactor = 75 }: Props) {
  const factor = simulatorEnabled ? simulatorFactor : 1;
  const [viewMode, setViewMode] = useState<ViewMode>("realtime");
  const [zoomInterval, setZoomInterval] = useState<ZoomInterval>(5);
  const [hourlyData, setHourlyData] = useState<{ time: string; listeners: number }[]>([]);
  const [dailyData, setDailyData] = useState<{ time: string; listeners: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ time: string; listeners: number }[]>([]);
  const [allSnapshots, setAllSnapshots] = useState<SnapshotRow[]>([]);
  const [blendView, setBlendView] = useState<BlendView>("horario");
  const [blendData, setBlendData] = useState<Record<string, any>[]>([]);
  const [blendVisibleStations, setBlendVisibleStations] = useState<Set<string>>(() => new Set(visibleStations ?? stations.map(s => s.id)));
  const realtimeChartRef = useRef<HTMLDivElement>(null);
  const blendChartRef = useRef<HTMLDivElement>(null);

  // Sync blend visible with parent visible
  useEffect(() => {
    if (visibleStations) {
      setBlendVisibleStations(new Set(visibleStations));
    }
  }, [visibleStations]);

  const toggleBlendStation = useCallback((id: string) => {
    setBlendVisibleStations(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSavePng = useCallback(async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    try {
      // Add temporary date/time watermark
      const stamp = document.createElement('div');
      stamp.style.cssText = 'position:absolute;bottom:8px;right:12px;font-size:11px;color:rgba(255,255,255,0.7);font-family:monospace;z-index:10;background:rgba(0,0,0,0.5);padding:2px 8px;border-radius:4px;';
      stamp.textContent = getDateTimeStamp();
      ref.current.style.position = 'relative';
      ref.current.appendChild(stamp);

      const dataUrl = await toPng(ref.current, { backgroundColor: '#0f1729', pixelRatio: 2 });
      
      // Remove watermark
      ref.current.removeChild(stamp);

      const link = document.createElement('a');
      link.download = `${filename}_${formatBrasiliaDateInput()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao salvar PNG:', err);
    }
  }, []);

  // Blend stations filtered
  const blendStations = useMemo(() => {
    return stations.filter(s => blendVisibleStations.has(s.id));
  }, [blendVisibleStations]);

  // Fetch blend data (all stations) when blend mode is active
  useEffect(() => {
    if (!open || viewMode !== "blend") return;

    async function fetchBlendData() {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const allData: { station_id: string; listeners: number; hour: number; recorded_at: string }[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data } = await supabase
          .from("audience_snapshots")
          .select("station_id, listeners, hour, recorded_at")
          .gte("recorded_at", cutoff)
          .order("recorded_at", { ascending: true })
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      if (allData.length === 0) { setBlendData([]); return; }

      if (blendView === "horario") {
        const todayStr = formatBrasiliaDateInput();
        const todayData = allData.filter(s => formatBrasiliaDateInput(new Date(s.recorded_at)) === todayStr);
        const hourMap = new Map<number, Map<string, number[]>>();
        todayData.forEach(s => {
          if (!hourMap.has(s.hour)) hourMap.set(s.hour, new Map());
          const stMap = hourMap.get(s.hour)!;
          if (!stMap.has(s.station_id)) stMap.set(s.station_id, []);
          stMap.get(s.station_id)!.push(s.listeners);
        });
        const rows = Array.from({ length: 24 }, (_, h) => {
          const row: Record<string, any> = { time: `${String(h).padStart(2, "0")}:00` };
          const stMap = hourMap.get(h);
          stations.forEach(st => {
            const vals = stMap?.get(st.id) || [];
            row[st.id] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
          });
          return row;
        });
        setBlendData(rows);
      } else {
        const dayMap = new Map<number, Map<string, number[]>>();
        allData.forEach(s => {
          const dt = new Date(new Date(s.recorded_at).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
          const d = dt.getDay();
          if (!dayMap.has(d)) dayMap.set(d, new Map());
          const stMap = dayMap.get(d)!;
          if (!stMap.has(s.station_id)) stMap.set(s.station_id, []);
          stMap.get(s.station_id)!.push(s.listeners);
        });
        const rows = [0, 1, 2, 3, 4, 5, 6].map(d => {
          const row: Record<string, any> = { time: DAY_NAMES[d] };
          const stMap = dayMap.get(d);
          stations.forEach(st => {
            const vals = stMap?.get(st.id) || [];
            row[st.id] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
          });
          return row;
        });
        setBlendData(rows);
      }
    }

    fetchBlendData();
  }, [open, viewMode, blendView]);

  useEffect(() => {
    if (!open || !status) return;

    async function fetchAll() {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const allData: SnapshotRow[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data } = await supabase
          .from("audience_snapshots")
          .select("listeners, hour, recorded_at")
          .eq("station_id", status!.station.id)
          .gte("recorded_at", cutoff)
          .order("recorded_at", { ascending: true })
          .range(from, from + pageSize - 1);

        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      return allData;
    }

    fetchAll().then((data) => {
        if (!data || data.length === 0) {
          setHourlyData(status.history);
          setDailyData([]);
          setMonthlyData([]);
          setAllSnapshots([]);
          return;
        }

        setAllSnapshots(data);

        const todayStr = formatBrasiliaDateInput();
        const todayData = data.filter(
          (snap) => formatBrasiliaDateInput(new Date(snap.recorded_at)) === todayStr
        );

        const todayHourMap = new Map<number, number[]>();
        todayData.forEach((snap) => {
          const h = snap.hour;
          if (!todayHourMap.has(h)) todayHourMap.set(h, []);
          todayHourMap.get(h)!.push(snap.listeners);
        });

        const hData = Array.from({ length: 24 }, (_, i) => i).map((h) => {
          const vals = todayHourMap.get(h) || [];
          const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
          return { time: `${String(h).padStart(2, "0")}:00`, listeners: avg };
        });

        const dayMap = new Map<number, number[]>();
        const monthMap = new Map<string, { sum: number; count: number }>();

        data.forEach((snap) => {
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

  const todayStats = useMemo(() => {
    if (!status || allSnapshots.length === 0) {
      return { peakValue: 0, peakTimeStr: "--:--", minValue: 0, minTimeStr: "--:--" };
    }
    const todayStr = formatBrasiliaDateInput();
    const todaySnaps = allSnapshots.filter(
      (snap) => formatBrasiliaDateInput(new Date(snap.recorded_at)) === todayStr
    );
    if (todaySnaps.length === 0) {
      return { peakValue: 0, peakTimeStr: "--:--", minValue: 0, minTimeStr: "--:--" };
    }

    let peakSnap = todaySnaps[0];
    let minSnap = todaySnaps[0];
    for (const snap of todaySnaps) {
      if (snap.listeners > peakSnap.listeners) peakSnap = snap;
      if (snap.listeners < minSnap.listeners) minSnap = snap;
    }

    const formatTime = (snap: SnapshotRow) => {
      const d = new Date(snap.recorded_at);
      return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    };

    return {
      peakValue: peakSnap.listeners,
      peakTimeStr: formatTime(peakSnap),
      minValue: minSnap.listeners,
      minTimeStr: formatTime(minSnap),
    };
  }, [allSnapshots, status]);

  const realtimeData = useMemo(() => {
    if (!status) return [];
    const todayStr = formatBrasiliaDateInput();
    const todaySnaps = allSnapshots.filter(
      (snap) => formatBrasiliaDateInput(new Date(snap.recorded_at)) === todayStr
    );

    if (todaySnaps.length === 0) return [];

    const intervalMin = zoomInterval;
    const slots: { time: string; minuteOfDay: number; listeners?: number }[] = [];

    for (let m = 0; m < 24 * 60; m += intervalMin) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const label = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      slots.push({ time: label, minuteOfDay: m });
    }

    const snapsWithMinute = todaySnaps.map((snap) => {
      const d = new Date(snap.recorded_at);
      const brasiliaStr = d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const b = new Date(brasiliaStr);
      return { ...snap, snapMinute: b.getHours() * 60 + b.getMinutes() };
    });

    for (const slot of slots) {
      const slotStart = slot.minuteOfDay;
      const slotEnd = slotStart + intervalMin;

      const matching = snapsWithMinute.filter(
        (s) => s.snapMinute >= slotStart && s.snapMinute < slotEnd
      );

      if (matching.length > 0) {
        slot.listeners = Math.round(matching.reduce((sum, s) => sum + s.listeners, 0) / matching.length * factor);
      }
    }

    const now = new Date();
    const brasiliaStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const bNow = new Date(brasiliaStr);
    const currentMinute = bNow.getHours() * 60 + bNow.getMinutes();

    return slots.filter((slot) => {
      if (slot.minuteOfDay > currentMinute + intervalMin) return false;
      return slot.listeners !== undefined;
    });
  }, [allSnapshots, zoomInterval, status, factor]);

  if (!status) return null;
  const { station, listeners } = status;

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
            <p className="text-[11px] text-muted-foreground uppercase">Pico Hoje</p>
            <p className="font-mono font-bold text-accent">{todayStats.peakValue.toLocaleString("pt-BR")}</p>
            <p className="text-[10px] text-muted-foreground font-mono">às {todayStats.peakTimeStr}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <TrendingDown className="h-4 w-4 mx-auto mb-1 text-orange-400" />
            <p className="text-[11px] text-muted-foreground uppercase">Menor Hoje</p>
            <p className="font-mono font-bold text-orange-400">{todayStats.minValue.toLocaleString("pt-BR")}</p>
            <p className="text-[10px] text-muted-foreground font-mono">às {todayStats.minTimeStr}</p>
          </div>
        </div>

        {/* View mode tabs */}
        <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 mb-3">
          {([
            { id: "realtime" as ViewMode, label: "Tempo Real", icon: Activity },
            { id: "horario" as ViewMode, label: "Horário", icon: Clock },
            { id: "dia" as ViewMode, label: "Dia", icon: Calendar },
            { id: "mes" as ViewMode, label: "Mês", icon: CalendarDays },
            { id: "blend" as ViewMode, label: "Blend", icon: Layers },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-medium py-2 rounded-md transition-colors ${
                viewMode === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Real-time chart */}
        {viewMode === "realtime" && (
          <div ref={realtimeChartRef} className="rounded-lg bg-secondary/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Audiência em Tempo Real — {dayName}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] border-border text-muted-foreground hover:text-foreground"
                onClick={() => handleSavePng(realtimeChartRef, `tempo_real_${station.name.replace(/\s+/g, '_')}`)}
              >
                <Download className="h-3 w-3 mr-1" />
                PNG
              </Button>
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

            {realtimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={realtimeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <ReferenceArea x1="00:00" x2="05:55" fill="hsl(var(--primary))" fillOpacity={0.08} />
                  <ReferenceArea x1="22:00" x2="23:55" fill="hsl(var(--primary))" fillOpacity={0.08} />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={Math.max(Math.floor(60 / zoomInterval) - 1, 0)} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} labelStyle={{ fontWeight: 700, marginBottom: 4 }} formatter={(value: number) => [value?.toLocaleString("pt-BR") ?? "—", "Conexões"]} />
                  <ReferenceLine x="22:00" stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine x="06:00" stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="listeners" name="Conexões" stroke="hsl(160 84% 44%)" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                Aguardando dados de hoje...
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 justify-center">
              <div className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/30" />
              <span className="text-[10px] text-muted-foreground">🌙 Madrugada (22h–05h)</span>
            </div>
          </div>
        )}

        {/* Historical charts */}
        {(viewMode === "horario" || viewMode === "dia" || viewMode === "mes") && (
          <div className="rounded-lg bg-secondary/30 p-4">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">
              {viewMode === "horario"
                ? "Audiência por Horário — Hoje (00h - 23h)"
                : viewMode === "dia"
                ? "Audiência por Dia da Semana"
                : "Audiência Média por Mês"}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="time" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 12%)", border: "1px solid hsl(220 14% 18%)", borderRadius: "8px", color: "hsl(210 20% 92%)", fontSize: 12 }} labelStyle={{ color: "hsl(210 20% 92%)" }} />
                <Bar dataKey="listeners" name="Conexões" fill="hsl(160 84% 44%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Blend chart - all stations overlaid */}
        {viewMode === "blend" && (
          <div ref={blendChartRef} className="rounded-lg bg-secondary/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Comparativo — Emissoras Selecionadas
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] border-border text-muted-foreground hover:text-foreground"
                onClick={() => handleSavePng(blendChartRef, 'blend_comparativo')}
              >
                <Download className="h-3 w-3 mr-1" />
                PNG
              </Button>
            </div>

            {/* Sub-mode toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-medium">Visualizar:</span>
              <Button
                size="sm"
                variant={blendView === "horario" ? "default" : "outline"}
                className={`text-[11px] h-7 px-3 ${blendView === "horario" ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                onClick={() => setBlendView("horario")}
              >
                <Clock className="h-3 w-3 mr-1" />
                Por Hora (Hoje)
              </Button>
              <Button
                size="sm"
                variant={blendView === "dia" ? "default" : "outline"}
                className={`text-[11px] h-7 px-3 ${blendView === "dia" ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                onClick={() => setBlendView("dia")}
              >
                <Calendar className="h-3 w-3 mr-1" />
                Por Dia
              </Button>
            </div>

            {/* Station legend with checkboxes */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-1">
              {stations.map((st, i) => (
                <label key={st.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={blendVisibleStations.has(st.id)}
                    onCheckedChange={() => toggleBlendStation(st.id)}
                  />
                  <div
                    className="w-3 h-[3px] rounded-full shrink-0"
                    style={{ backgroundColor: STATION_COLORS[i % STATION_COLORS.length] }}
                  />
                  <span className="text-[11px] text-foreground font-medium truncate">{st.name}</span>
                </label>
              ))}
            </div>

            {/* Chart */}
            {blendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={blendData} margin={{ top: 10, right: 10, left: -5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "hsl(215 12% 50%)", fontSize: 10 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} interval={blendView === "horario" ? 2 : 0} />
                  <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 14% 22%)", borderRadius: "10px", color: "hsl(210 20% 92%)", fontSize: 12, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                    labelStyle={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}
                    formatter={(value: number, name: string) => {
                      const st = stations.find(s => s.id === name);
                      return [value?.toLocaleString("pt-BR") ?? "—", st?.name ?? name];
                    }}
                    itemSorter={(item: any) => -(item.value || 0)}
                  />
                  {blendStations.map((st) => {
                    const globalIdx = stations.findIndex(s => s.id === st.id);
                    return (
                      <Line
                        key={st.id}
                        type="monotone"
                        dataKey={st.id}
                        name={st.id}
                        stroke={STATION_COLORS[globalIdx % STATION_COLORS.length]}
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls
                        strokeOpacity={0.9}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                Carregando dados comparativos...
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-2">
          {viewMode === "realtime" ? "Dados de hoje • Atualização a cada 30s" : viewMode === "blend" ? "Comparativo de emissoras selecionadas" : "Dados reais • Média dos últimos 90 dias"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
