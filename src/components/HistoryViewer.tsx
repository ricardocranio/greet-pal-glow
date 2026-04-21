import { useState, useEffect, useMemo, useCallback } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Download, FileText, History, BarChart3, ChevronDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useStations } from "@/hooks/useStations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Granularity = "daily" | "weekly" | "monthly";

interface Snapshot {
  station_id: string;
  recorded_at: string;
  hour: number;
  listeners: number;
  peak_listeners: number;
}

interface BucketRow {
  bucket: string;
  label: string;
  avg: number;
  peak: number;
  samples: number;
}

const stationName = (id: string, stationsList: { id: string; name: string }[]) => stationsList.find((s) => s.id === id)?.name || id;

function bucketKey(date: Date, gran: Granularity): { key: string; label: string } {
  if (gran === "daily") {
    const k = format(date, "yyyy-MM-dd");
    return { key: k, label: format(date, "dd/MM", { locale: ptBR }) };
  }
  if (gran === "weekly") {
    // ISO week start (Monday)
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    const k = format(d, "yyyy-MM-dd");
    return { key: k, label: `Sem ${format(d, "dd/MM", { locale: ptBR })}` };
  }
  const k = format(date, "yyyy-MM");
  return { key: k, label: format(date, "MMM/yy", { locale: ptBR }) };
}

export default function HistoryViewer() {
  const { stations } = useStations();
  const [stationId, setStationId] = useState<string>("");
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [from, setFrom] = useState<Date>(subDays(new Date(), 14));
  const [to, setTo] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  // Set default station when stations load
  useEffect(() => {
    if (!stationId && stations.length > 0) setStationId(stations[0].id);
  }, [stations, stationId]);

  const fetchData = useCallback(async () => {
    if (!stationId) return;
    setLoading(true);
    const fromISO = startOfDay(from).toISOString();
    const toISO = endOfDay(to).toISOString();
    let all: Snapshot[] = [];
    let pageStart = 0;
    const pageSize = 1000;
    // paginate to bypass 1000-row limit
    while (true) {
      const { data, error } = await supabase
        .from("audience_snapshots")
        .select("station_id,recorded_at,hour,listeners,peak_listeners")
        .eq("station_id", stationId)
        .gte("recorded_at", fromISO)
        .lte("recorded_at", toISO)
        .order("recorded_at", { ascending: true })
        .range(pageStart, pageStart + pageSize - 1);
      if (error) {
        toast.error(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      all = all.concat(data as Snapshot[]);
      if (data.length < pageSize) break;
      pageStart += pageSize;
    }
    setSnapshots(all);
    setLoading(false);
  }, [stationId, from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const buckets: BucketRow[] = useMemo(() => {
    const map = new Map<string, { label: string; sum: number; peak: number; n: number }>();
    snapshots.forEach((s) => {
      const d = new Date(s.recorded_at);
      const { key, label } = bucketKey(d, granularity);
      const cur = map.get(key) || { label, sum: 0, peak: 0, n: 0 };
      cur.sum += s.listeners;
      cur.peak = Math.max(cur.peak, s.peak_listeners || s.listeners);
      cur.n += 1;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, v]) => ({
        bucket,
        label: v.label,
        avg: Math.round(v.sum / Math.max(1, v.n)),
        peak: v.peak,
        samples: v.n,
      }));
  }, [snapshots, granularity]);

  const totals = useMemo(() => {
    if (buckets.length === 0) return { avg: 0, peak: 0, samples: 0 };
    const avg = Math.round(buckets.reduce((a, b) => a + b.avg, 0) / buckets.length);
    const peak = buckets.reduce((a, b) => Math.max(a, b.peak), 0);
    const samples = buckets.reduce((a, b) => a + b.samples, 0);
    return { avg, peak, samples };
  }, [buckets]);

  const periodLabel = `${format(from, "dd/MM/yyyy")} – ${format(to, "dd/MM/yyyy")}`;
  const granLabel = { daily: "Diário", weekly: "Semanal", monthly: "Mensal" }[granularity];

  const exportCSV = () => {
    const rows = [
      ["Estação", stationName(stationId, stations)],
      ["Período", periodLabel],
      ["Granularidade", granLabel],
      [],
      ["Bucket", "Rótulo", "Média Ouvintes", "Pico Ouvintes", "Amostras"],
      ...buckets.map((b) => [b.bucket, b.label, b.avg, b.peak, b.samples]),
      [],
      ["Resumo", "", totals.avg, totals.peak, totals.samples],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico_${stationId}_${granularity}_${format(from, "yyyyMMdd")}_${format(to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const loadImageAsDataURL = async (url: string): Promise<{ data: string; w: number; h: number; fmt: "PNG" | "JPEG" } | null> => {
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const data: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = data;
      });
      const fmt = blob.type.includes("png") ? "PNG" : "JPEG";
      return { data, w: dims.w, h: dims.h, fmt };
    } catch {
      return null;
    }
  };

  const exportPDF = async (mode: "light" | "dark") => {
    const isDark = mode === "dark";
    const bg: [number, number, number] = isDark ? [15, 23, 41] : [255, 255, 255];
    const fg: [number, number, number] = isDark ? [240, 240, 245] : [20, 20, 25];
    const headBg: [number, number, number] = isDark ? [30, 41, 59] : [30, 30, 30];
    const headFg: [number, number, number] = [255, 255, 255];
    const altRow: [number, number, number] = isDark ? [22, 30, 48] : [245, 245, 248];
    const wmColor: [number, number, number] = isDark ? [60, 75, 100] : [220, 220, 225];

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const station = stations.find((s) => s.id === stationId);
    const logo = station?.logoUrl ? await loadImageAsDataURL(station.logoUrl) : null;

    const drawPageChrome = () => {
      // Background
      doc.setFillColor(...bg);
      doc.rect(0, 0, pageW, pageH, "F");

      // Diagonal watermark
      doc.saveGraphicsState?.();
      doc.setTextColor(...wmColor);
      doc.setFontSize(60);
      const wmText = "AUDIÊNCIA NATAL/RN";
      // jsPDF supports angle via text options
      doc.text(wmText, pageW / 2, pageH / 2, { align: "center", angle: 30 } as never);
      doc.restoreGraphicsState?.();

      // Footer brand
      doc.setFontSize(8);
      doc.setTextColor(...fg);
      doc.text("Audiência Natal/RN", 14, pageH - 8);
      doc.text(format(new Date(), "dd/MM/yyyy HH:mm"), pageW - 14, pageH - 8, { align: "right" });
    };

    drawPageChrome();

    // Header logo
    let textX = 14;
    if (logo) {
      const logoH = 16;
      const logoW = (logo.w / logo.h) * logoH;
      try {
        doc.addImage(logo.data, logo.fmt, 14, 10, logoW, logoH);
        textX = 14 + logoW + 6;
      } catch {
        /* ignore */
      }
    }

    doc.setTextColor(...fg);
    doc.setFontSize(16);
    doc.text("Relatório Consolidado de Audiência", textX, 18);
    doc.setFontSize(11);
    doc.text(`Estação: ${stationName(stationId, stations)}`, textX, 28);

    doc.text(`Período: ${periodLabel}`, 14, 40);
    doc.text(`Granularidade: ${granLabel}`, 14, 46);
    doc.text(
      `Média geral: ${totals.avg.toLocaleString("pt-BR")}   Pico: ${totals.peak.toLocaleString("pt-BR")}   Amostras: ${totals.samples}`,
      14,
      52
    );

    autoTable(doc, {
      startY: 58,
      head: [["Período", "Média Ouvintes", "Pico Ouvintes", "Amostras"]],
      body: buckets.map((b) => [b.label, b.avg.toLocaleString("pt-BR"), b.peak.toLocaleString("pt-BR"), b.samples]),
      styles: { fontSize: 9, textColor: fg, fillColor: bg },
      headStyles: { fillColor: headBg, textColor: headFg },
      alternateRowStyles: { fillColor: altRow },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawPageChrome();
      },
    });

    const tag = isDark ? "PDF-B" : "PDF-W";
    doc.save(`historico_${stationId}_${granularity}_${tag}_${format(from, "yyyyMMdd")}_${format(to, "yyyyMMdd")}.pdf`);
    toast.success(`${tag} exportado`);
  };

  const setPreset = (days: number) => {
    setTo(new Date());
    setFrom(subDays(new Date(), days));
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Histórico por Estação
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={buckets.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" /> Download <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportCSV}>
              <Download className="h-3.5 w-3.5 mr-2" /> CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportPDF("light")}>
              <FileText className="h-3.5 w-3.5 mr-2" /> PDF-W
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportPDF("dark")}>
              <FileText className="h-3.5 w-3.5 mr-2" /> PDF-B
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Select value={stationId} onValueChange={setStationId}>
          <SelectTrigger><SelectValue placeholder="Estação" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {stations.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Diário</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !from && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {from ? format(from, "dd/MM/yyyy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={from} onSelect={(d) => d && setFrom(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !to && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {to ? format(to, "dd/MM/yyyy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={to} onSelect={(d) => d && setTo(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {[
          { l: "7 dias", d: 7 },
          { l: "14 dias", d: 14 },
          { l: "30 dias", d: 30 },
          { l: "90 dias", d: 90 },
          { l: "180 dias", d: 180 },
          { l: "365 dias", d: 365 },
        ].map((p) => (
          <Button key={p.d} size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPreset(p.d)}>
            {p.l}
          </Button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-secondary/40 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase">Média</p>
          <p className="text-lg font-bold text-foreground">{totals.avg.toLocaleString("pt-BR")}</p>
        </div>
        <div className="bg-secondary/40 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase">Pico</p>
          <p className="text-lg font-bold text-primary">{totals.peak.toLocaleString("pt-BR")}</p>
        </div>
        <div className="bg-secondary/40 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground uppercase">Amostras</p>
          <p className="text-lg font-bold text-foreground">{totals.samples.toLocaleString("pt-BR")}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-72 w-full bg-secondary/20 rounded-lg p-2">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Carregando...</div>
        ) : buckets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
            <BarChart3 className="h-6 w-6 opacity-50" />
            Sem dados no período selecionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={buckets} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="avg" name="Média" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="peak" name="Pico" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
