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
import { TrendingUp, TrendingDown, Clock, Users, Calendar, CalendarDays, ZoomIn, Activity, Layers, Download, Zap, Maximize2, Minimize2, FileText, GitCompare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBrasiliaDateInput, getBrasiliaDay } from "@/lib/brasiliaTime";
import { stations } from "@/data/stations";
import { toPng } from "html-to-image";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import logo98fm from "@/assets/logo-98fm.png";
import logo97fm from "@/assets/logo-97fm.png";
import logo96fm from "@/assets/logo-96fm.png";
import logo95fm from "@/assets/logo-95fm.png";
import logo91fm from "@/assets/logo-91fm.png";
import logo104fm from "@/assets/logo-104fm.png";
import logoClubefm from "@/assets/logo-clubefm.png";
import logoJpnatal from "@/assets/logo-jpnatal.png";
import logoJpnews from "@/assets/logo-jpnews.png";
import logoMundialfm from "@/assets/logo-mundialfm.png";
import logoCidadefm from "@/assets/logo-cidadefm.jpg";

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
type HorarioFilter = "dia" | "seg-sex" | "sab-dom" | "geral";

const STATION_COLORS = [
  "hsl(160 84% 44%)", "hsl(210 90% 55%)", "hsl(340 75% 55%)", "hsl(45 90% 50%)",
  "hsl(280 70% 55%)", "hsl(20 85% 55%)", "hsl(180 60% 45%)", "hsl(120 50% 45%)",
  "hsl(0 70% 55%)", "hsl(240 60% 60%)", "hsl(30 80% 50%)", "hsl(200 70% 50%)",
];

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const LOCAL_STATION_LOGOS: Record<string, string> = {
  "98fm": logo98fm,
  "97fm": logo97fm,
  "96fm": logo96fm,
  "95fm": logo95fm,
  "91fm": logo91fm,
  "104fm": logo104fm,
  "clubefm": logoClubefm,
  "jpnatal": logoJpnatal,
  "jpnews": logoJpnews,
  "mundialfm": logoMundialfm,
  "cidadefm": logoCidadefm,
};

const getStationLogoSrc = (stationId: string, logoUrl?: string) => LOCAL_STATION_LOGOS[stationId] || logoUrl || "";

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

// Compute average for an array of numbers
function calcAvg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export function ReportDialog({ status, open, onOpenChange, visibleStations, simulatorEnabled = false, simulatorFactor = 75 }: Props) {
  const factor = simulatorEnabled ? simulatorFactor : 1;
  const [viewMode, setViewMode] = useState<ViewMode>("realtime");
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [zoomInterval, setZoomInterval] = useState<ZoomInterval>(5);
  const [hourlyData, setHourlyData] = useState<{ time: string; listeners: number }[]>([]);
  const [dailyData, setDailyData] = useState<{ time: string; listeners: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ time: string; listeners: number }[]>([]);
  const [allSnapshots, setAllSnapshots] = useState<SnapshotRow[]>([]);
  const [blendView, setBlendView] = useState<BlendView>("horario");
  const [blendData, setBlendData] = useState<Record<string, any>[]>([]);
  const [blendVisibleStations, setBlendVisibleStations] = useState<Set<string>>(() => new Set(visibleStations ?? stations.map(s => s.id)));
  const [blendDate, setBlendDate] = useState<Date>(new Date());
  const [horarioFilter, setHorarioFilter] = useState<HorarioFilter>("dia");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  // Hour-range filter (00..23). End is inclusive — covers minute 59 of that hour.
  const [hourStart, setHourStart] = useState<number>(0);
  const [hourEnd, setHourEnd] = useState<number>(23);
  const [compareStationId, setCompareStationId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingMain, setIsLoadingMain] = useState(false);
  const [isLoadingBlend, setIsLoadingBlend] = useState(false);
  const [isLoadingHorario, setIsLoadingHorario] = useState(false);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const realtimeChartRef = useRef<HTMLDivElement>(null);
  const blendChartRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Helper: convert cross-origin images to data URLs to avoid CORS tainting
  const inlineImages = useCallback(async (container: HTMLElement) => {
    const imgs = container.querySelectorAll('img');
    const originals: { img: HTMLImageElement; src: string }[] = [];
    await Promise.all(Array.from(imgs).map(async (img) => {
      if (!img.src || img.src.startsWith('data:')) return;
      originals.push({ img, src: img.src });
      try {
        const resp = await fetch(img.src, { mode: 'cors' });
        const blob = await resp.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        img.src = dataUrl;
      } catch {
        // If CORS fails, replace with a colored placeholder
        img.src = 'data:image/svg+xml,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="#1e293b"/><text x="20" y="25" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="sans-serif">FM</text></svg>`
        );
      }
    }));
    return originals;
  }, []);

  const restoreImages = useCallback((originals: { img: HTMLImageElement; src: string }[]) => {
    originals.forEach(({ img, src }) => { img.src = src; });
  }, []);

  const handleSavePng = useCallback(async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    let originals: { img: HTMLImageElement; src: string }[] = [];
    try {
      originals = await inlineImages(ref.current);

      const stamp = document.createElement('div');
      stamp.style.cssText = 'position:absolute;bottom:8px;right:12px;font-size:11px;color:rgba(255,255,255,0.7);font-family:monospace;z-index:10;background:rgba(0,0,0,0.5);padding:2px 8px;border-radius:4px;';
      stamp.textContent = getDateTimeStamp();
      ref.current.style.position = 'relative';
      ref.current.appendChild(stamp);

      const dataUrl = await toPng(ref.current, { backgroundColor: '#0f1729', pixelRatio: 3 });
      
      ref.current.removeChild(stamp);

      const link = document.createElement('a');
      link.download = `${filename}_${formatBrasiliaDateInput()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao salvar PNG:', err);
    } finally {
      restoreImages(originals);
    }
  }, [inlineImages, restoreImages]);

  // PDF export (light or dark)
  const handleExportPdf = useCallback(async (mode: 'light' | 'dark') => {
    if (!contentRef.current) return;
    setIsExporting(true);
    const el = contentRef.current;
    let originals: { img: HTMLImageElement; src: string }[] = [];
    
    try {
      // Inline images to avoid CORS issues
      originals = await inlineImages(el);

      // Wait a tick for export class to apply (hides buttons)
      await new Promise(r => setTimeout(r, 150));

      const bgColor = mode === 'light' ? '#ffffff' : '#0f1729';
      
      // Temporarily apply light mode styles if needed
      if (mode === 'light') {
        el.classList.add('pdf-light-mode');
        // Wait for styles to apply
        await new Promise(r => setTimeout(r, 100));
      }

      const dataUrl = await toPng(el, {
        backgroundColor: bgColor,
        pixelRatio: 3,
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.dataset.exportHide === 'true') return false;
          }
          return true;
        },
      });

      const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
      const modeLabel = mode === 'light' ? 'W' : 'B';
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
      });
      const scaledHeight = (image.height * usableWidth) / image.width;
      const pageFill = () => {
        pdf.setFillColor(mode === 'light' ? 255 : 15, mode === 'light' ? 255 : 23, mode === 'light' ? 255 : 41);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      };

      pageFill();
      let offsetY = 0;
      let remainingHeight = scaledHeight;

      while (remainingHeight > 0) {
        pdf.addImage(dataUrl, 'PNG', margin, margin - offsetY, usableWidth, scaledHeight, undefined, 'FAST');
        remainingHeight -= usableHeight;
        offsetY += usableHeight;
        if (remainingHeight > 0) {
          pdf.addPage();
          pageFill();
        }
      }

      pdf.save(`relatorio_${viewMode}_PDF-${modeLabel}_${formatBrasiliaDateInput()}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar:', err);
    } finally {
      // Always remove light mode class and restore images
      el.classList.remove('pdf-light-mode');
      restoreImages(originals);
      setIsExporting(false);
    }
  }, [viewMode, inlineImages, restoreImages]);

  // Blend stations filtered & sorted by audience (respects hour-range filter when in horario view)
  const blendStations = useMemo(() => {
    const filtered = stations.filter(s => blendVisibleStations.has(s.id));
    if (blendData.length === 0) return filtered;

    // For horario view, only consider rows inside the selected hour range so
    // the ranking matches the displayed/exported recorte (e.g., 08h–11h).
    const rowsForRanking = blendView === "horario"
      ? blendData.filter(row => {
          const h = parseInt(String(row.time).slice(0, 2), 10);
          return Number.isFinite(h) && h >= hourStart && h <= hourEnd;
        })
      : blendData;

    return [...filtered].sort((a, b) => {
      const valsA = rowsForRanking.map(r => r[a.id]).filter((v): v is number => v != null && v > 0);
      const valsB = rowsForRanking.map(r => r[b.id]).filter((v): v is number => v != null && v > 0);
      const avgA = valsA.length > 0 ? valsA.reduce((s, v) => s + v, 0) / valsA.length : 0;
      const avgB = valsB.length > 0 ? valsB.reduce((s, v) => s + v, 0) / valsB.length : 0;
      return avgB - avgA;
    });
  }, [blendVisibleStations, blendData, blendView, hourStart, hourEnd]);

  // Fetch blend data via server-side aggregate (1 row per station+hour or station+dow)
  useEffect(() => {
    if (!open || viewMode !== "blend") return;
    let cancelled = false;
    setIsLoadingBlend(true);
    async function fetchBlendData() {
      const dateStr = formatBrasiliaDateInput(blendDate);
      const p_from = blendView === "horario"
        ? `${dateStr}T00:00:00-03:00`
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const p_to = blendView === "horario"
        ? `${dateStr}T23:59:59-03:00`
        : new Date().toISOString();

      const rpcName = blendView === "horario" ? "blend_hourly_avg" : "blend_dow_avg";
      const { data } = await supabase.rpc(rpcName, { p_from, p_to });
      if (cancelled) return;
      if (!data || data.length === 0) { setBlendData([]); return; }

      if (blendView === "horario") {
        // Pivot: rows = 24 hours, cols = stations
        const pivot = new Map<number, Map<string, number>>();
        (data as { station_id: string; hour: number; avg_listeners: number }[]).forEach(r => {
          if (!pivot.has(r.hour)) pivot.set(r.hour, new Map());
          pivot.get(r.hour)!.set(r.station_id, r.avg_listeners);
        });
        const rows = Array.from({ length: 24 }, (_, h) => {
          const row: Record<string, any> = { time: `${String(h).padStart(2, "0")}:00` };
          const stMap = pivot.get(h);
          stations.forEach(st => { row[st.id] = stMap?.get(st.id) ?? null; });
          return row;
        });
        setBlendData(rows);
      } else {
        // Pivot: rows = 7 days-of-week, cols = stations
        const pivot = new Map<number, Map<string, number>>();
        (data as unknown as { station_id: string; dow: number; avg_listeners: number }[]).forEach(r => {
          if (!pivot.has(r.dow)) pivot.set(r.dow, new Map());
          pivot.get(r.dow)!.set(r.station_id, r.avg_listeners);
        });
        const rows = [0, 1, 2, 3, 4, 5, 6].map(d => {
          const row: Record<string, any> = { time: DAY_NAMES[d] };
          const stMap = pivot.get(d);
          stations.forEach(st => { row[st.id] = stMap?.get(st.id) ?? null; });
          return row;
        });
        setBlendData(rows);
      }
    }

    fetchBlendData().finally(() => {
      if (!cancelled) setIsLoadingBlend(false);
    });
    return () => { cancelled = true; };
  }, [open, viewMode, blendView, blendDate]);

  // FAST LOAD: only today's raw snapshots (small set) for realtime chart + stats.
  // Heavy aggregations (hourly/daily/monthly across 90 days) are done server-side via RPCs.
  useEffect(() => {
    if (!open || !status) return;
    let cancelled = false;
    const stationId = status.station.id;
    const cutoffIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    // Reset to avoid showing stale data from a previously opened station
    setAllSnapshots([]);
    setHourlyData(status.history);
    setDailyData([]);
    setMonthlyData([]);
    setIsLoadingMain(true);

    const tasks = [
      // 1) Today's raw points only (for realtime chart). Small payload.
      (async () => {
        const { data } = await supabase.rpc("station_today_realtime", { p_station_id: stationId });
        if (cancelled) return;
        setAllSnapshots((data ?? []) as SnapshotRow[]);
      })(),

      // 2) Hourly averages (today only — used as default in horario tab when no filter active)
      (async () => {
        const todayStartIso = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        todayStartIso.setHours(0, 0, 0, 0);
        const { data } = await supabase.rpc("station_hourly_avg", {
          p_station_id: stationId,
          p_from: todayStartIso.toISOString(),
          p_to: nowIso,
          p_dow_filter: "all",
        });
        if (cancelled) return;
        const map = new Map<number, number>();
        (data ?? []).forEach((r: { hour: number; avg_listeners: number }) => map.set(r.hour, r.avg_listeners));
        setHourlyData(Array.from({ length: 24 }, (_, h) => ({
          time: `${String(h).padStart(2, "0")}:00`,
          listeners: map.get(h) ?? 0,
        })));
      })(),

      // 3) Day-of-week averages (90 days)
      (async () => {
        const { data } = await supabase.rpc("station_dow_avg", {
          p_station_id: stationId,
          p_from: cutoffIso,
          p_to: nowIso,
        });
        if (cancelled) return;
        const map = new Map<number, number>();
        (data ?? []).forEach((r: { dow: number; avg_listeners: number }) => map.set(r.dow, r.avg_listeners));
        setDailyData([0, 1, 2, 3, 4, 5, 6].map(d => ({
          time: DAY_NAMES[d],
          listeners: map.get(d) ?? 0,
        })));
      })(),

      // 4) Monthly averages (90 days)
      (async () => {
        const { data } = await supabase.rpc("station_month_avg", {
          p_station_id: stationId,
          p_from: cutoffIso,
          p_to: nowIso,
        });
        if (cancelled) return;
        const rows = (data ?? []) as { month: string; avg_listeners: number }[];
        setMonthlyData(rows.map(r => {
          const mm = parseInt(r.month.split("-")[1], 10);
          return { time: MONTH_NAMES[mm - 1], listeners: r.avg_listeners };
        }));
      })(),
    ];

    Promise.all(tasks).finally(() => {
      if (!cancelled) setIsLoadingMain(false);
    });

    return () => { cancelled = true; };
  }, [open, status]);

  // Server-side hourly aggregates for the horario tab (filtered by dow / specific date)
  // Replaces the client-side filtering of allSnapshots that previously required loading 90 days of data.
  const [serverHourlyData, setServerHourlyData] = useState<{ time: string; listeners: number; hour: number }[] | null>(null);
  useEffect(() => {
    if (!open || !status || viewMode !== "horario") { setServerHourlyData(null); setIsLoadingHorario(false); return; }
    const isToday = horarioFilter === "dia" && (!selectedDate || formatBrasiliaDateInput(selectedDate) === formatBrasiliaDateInput());
    if (isToday) { setServerHourlyData(null); setIsLoadingHorario(false); return; }

    let cancelled = false;
    setIsLoadingHorario(true);
    (async () => {
      const stationId = status.station.id;
      let p_from: string, p_to: string, p_dow_filter: string;
      if (horarioFilter === "dia" && selectedDate) {
        const dStr = formatBrasiliaDateInput(selectedDate);
        p_from = `${dStr}T00:00:00-03:00`;
        p_to = `${dStr}T23:59:59-03:00`;
        p_dow_filter = "all";
      } else {
        p_from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        p_to = new Date().toISOString();
        p_dow_filter = horarioFilter === "seg-sex" ? "weekday" : horarioFilter === "sab-dom" ? "weekend" : "all";
      }
      const { data } = await supabase.rpc("station_hourly_avg", {
        p_station_id: stationId, p_from, p_to, p_dow_filter,
      });
      if (cancelled) return;
      const map = new Map<number, number>();
      (data ?? []).forEach((r: { hour: number; avg_listeners: number }) => map.set(r.hour, r.avg_listeners));
      setServerHourlyData(Array.from({ length: 24 }, (_, h) => ({
        time: `${String(h).padStart(2, "0")}:00`,
        listeners: map.get(h) ?? 0,
        hour: h,
      })));
      setIsLoadingHorario(false);
    })();
    return () => { cancelled = true; };
  }, [open, status, viewMode, horarioFilter, selectedDate]);

  // Server-side peak/min for stats card (replaces scanning 90 days of allSnapshots client-side)
  const [serverPeakMin, setServerPeakMin] = useState<{
    peak: number; peakAt: string | null; min: number; minAt: string | null; samples: number;
  } | null>(null);
  useEffect(() => {
    if (!open || !status || viewMode !== "horario") { setServerPeakMin(null); return; }
    const isTodayDia = horarioFilter === "dia" && (!selectedDate || formatBrasiliaDateInput(selectedDate) === formatBrasiliaDateInput());
    if (isTodayDia) { setServerPeakMin(null); return; } // today path uses allSnapshots (already small)

    let cancelled = false;
    (async () => {
      const stationId = status.station.id;
      let p_from: string, p_to: string, p_dow_filter: string;
      if (horarioFilter === "dia" && selectedDate) {
        const dStr = formatBrasiliaDateInput(selectedDate);
        p_from = `${dStr}T00:00:00-03:00`;
        p_to = `${dStr}T23:59:59-03:00`;
        p_dow_filter = "date";
      } else {
        p_from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        p_to = new Date().toISOString();
        p_dow_filter = horarioFilter === "seg-sex" ? "weekday" : horarioFilter === "sab-dom" ? "weekend" : "all";
      }
      const { data } = await supabase.rpc("station_peak_min", {
        p_station_id: stationId, p_from, p_to, p_dow_filter,
      });
      if (cancelled) return;
      const row = (data ?? [])[0];
      if (!row) { setServerPeakMin({ peak: 0, peakAt: null, min: 0, minAt: null, samples: 0 }); return; }
      setServerPeakMin({
        peak: row.peak_listeners, peakAt: row.peak_at,
        min: row.min_listeners, minAt: row.min_at, samples: row.samples,
      });
    })();
    return () => { cancelled = true; };
  }, [open, status, viewMode, horarioFilter, selectedDate]);

  // Filtered hourly data: prefer server-aggregated result; fall back to today snapshots / hourlyData
  const filteredHourlyData = useMemo(() => {
    if (viewMode !== "horario") return hourlyData;
    if (serverHourlyData) {
      return serverHourlyData.filter(d => d.hour >= hourStart && d.hour <= hourEnd);
    }
    // Today path: use allSnapshots (only today's points are loaded — small set)
    const hourMap = new Map<number, number[]>();
    allSnapshots.forEach((snap) => {
      if (!hourMap.has(snap.hour)) hourMap.set(snap.hour, []);
      hourMap.get(snap.hour)!.push(snap.listeners);
    });
    return Array.from({ length: 24 }, (_, h) => {
      const vals = hourMap.get(h) || [];
      const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      return { time: `${String(h).padStart(2, "0")}:00`, listeners: avg, hour: h };
    }).filter(d => d.hour >= hourStart && d.hour <= hourEnd);
  }, [viewMode, serverHourlyData, allSnapshots, hourlyData, hourStart, hourEnd]);

  // Compare station: server-aggregated hourly averages with same dow/date filter
  const [compareHourlyData, setCompareHourlyData] = useState<{ time: string; listeners: number; hour: number }[] | null>(null);
  useEffect(() => {
    if (!open || !compareStationId) { setCompareHourlyData(null); setIsLoadingCompare(false); return; }
    let cancelled = false;
    setIsLoadingCompare(true);
    (async () => {
      let p_from: string, p_to: string, p_dow_filter: string;
      if (horarioFilter === "dia") {
        const dStr = selectedDate ? formatBrasiliaDateInput(selectedDate) : formatBrasiliaDateInput();
        p_from = `${dStr}T00:00:00-03:00`;
        p_to = `${dStr}T23:59:59-03:00`;
        p_dow_filter = "all";
      } else {
        p_from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        p_to = new Date().toISOString();
        p_dow_filter = horarioFilter === "seg-sex" ? "weekday" : horarioFilter === "sab-dom" ? "weekend" : "all";
      }
      const { data } = await supabase.rpc("station_hourly_avg", {
        p_station_id: compareStationId, p_from, p_to, p_dow_filter,
      });
      if (cancelled) return;
      const map = new Map<number, number>();
      (data ?? []).forEach((r: { hour: number; avg_listeners: number }) => map.set(r.hour, r.avg_listeners));
      const rows = Array.from({ length: 24 }, (_, h) => ({
        time: `${String(h).padStart(2, "0")}:00`,
        listeners: map.get(h) ?? 0,
        hour: h,
      }));
      setCompareHourlyData(rows);
      setIsLoadingCompare(false);
    })();
    return () => { cancelled = true; };
  }, [open, compareStationId, horarioFilter, selectedDate]);

  const compareHourlyDataFiltered = useMemo(
    () => compareHourlyData?.filter(d => d.hour >= hourStart && d.hour <= hourEnd) ?? null,
    [compareHourlyData, hourStart, hourEnd]
  );

  const todayStats = useMemo(() => {
    if (!status) {
      return { peakValue: 0, peakTimeStr: "--:--", minValue: 0, minTimeStr: "--:--", label: "Hoje" };
    }

    const formatIso = (iso: string | null) => {
      if (!iso) return "--:--";
      const d = new Date(iso);
      return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    };

    // Horario tab with non-today filter → server-aggregated peak/min (fast)
    if (viewMode === "horario" && serverPeakMin) {
      let label = "Geral";
      if (horarioFilter === "dia" && selectedDate) label = format(selectedDate, "dd/MM", { locale: ptBR });
      else if (horarioFilter === "seg-sex") label = "Seg–Sex";
      else if (horarioFilter === "sab-dom") label = "Sáb–Dom";
      return {
        peakValue: Math.round(serverPeakMin.peak * factor),
        peakTimeStr: formatIso(serverPeakMin.peakAt),
        minValue: Math.round(serverPeakMin.min * factor),
        minTimeStr: formatIso(serverPeakMin.minAt),
        label,
      };
    }

    // Default path: today's snapshots only (already loaded, small set)
    if (allSnapshots.length === 0) {
      return { peakValue: 0, peakTimeStr: "--:--", minValue: 0, minTimeStr: "--:--", label: "Hoje" };
    }

    const todayStr = formatBrasiliaDateInput();
    const relevantSnaps = allSnapshots.filter(
      (snap) => formatBrasiliaDateInput(new Date(snap.recorded_at)) === todayStr
    );
    if (relevantSnaps.length === 0) {
      return { peakValue: 0, peakTimeStr: "--:--", minValue: 0, minTimeStr: "--:--", label: "Hoje" };
    }

    let peakSnap = relevantSnaps[0];
    let minSnap = relevantSnaps[0];
    for (const snap of relevantSnaps) {
      if (snap.listeners > peakSnap.listeners) peakSnap = snap;
      if (snap.listeners < minSnap.listeners) minSnap = snap;
    }
    return {
      peakValue: Math.round(peakSnap.listeners * factor),
      peakTimeStr: formatIso(peakSnap.recorded_at),
      minValue: Math.round(minSnap.listeners * factor),
      minTimeStr: formatIso(minSnap.recorded_at),
      label: "Hoje",
    };
  }, [allSnapshots, status, factor, viewMode, horarioFilter, selectedDate, serverPeakMin]);

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
      const utcMs = new Date(snap.recorded_at).getTime();
      const b = new Date(utcMs - 3 * 60 * 60 * 1000);
      return { ...snap, snapMinute: b.getUTCHours() * 60 + b.getUTCMinutes() };
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
    const bNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const currentMinute = bNow.getUTCHours() * 60 + bNow.getUTCMinutes();

    return slots.filter((slot) => {
      if (slot.minuteOfDay > currentMinute + intervalMin) return false;
      return slot.listeners !== undefined;
    });
  }, [allSnapshots, zoomInterval, status, factor]);

  // Merge compare station data into chart for horário view
  const compareStation = compareStationId ? stations.find(s => s.id === compareStationId) : null;
  const mergedHorarioData = useMemo(() => {
    if (viewMode !== "horario" || !compareHourlyDataFiltered || !compareStationId) return null;
    const base = factor !== 1
      ? filteredHourlyData.map(d => ({ ...d, listeners: Math.round(d.listeners * factor) }))
      : filteredHourlyData;
    return base.map((d, i) => ({
      time: d.time,
      listeners: d.listeners,
      compare: compareHourlyDataFiltered[i] ? (factor !== 1 ? Math.round(compareHourlyDataFiltered[i].listeners * factor) : compareHourlyDataFiltered[i].listeners) : 0,
    }));
  }, [viewMode, filteredHourlyData, compareHourlyDataFiltered, compareStationId, factor]);

  // Hour-range select component (used in "horario" tab and "blend > horario" sub-view)
  const HourRangeFilter = () => (
    <div className="flex items-center gap-1 ml-1">
      <span className="text-[9px] sm:text-[10px] font-bold text-accent uppercase tracking-wide">Faixa</span>
      <Select value={String(hourStart)} onValueChange={(v) => {
        const s = parseInt(v, 10);
        setHourStart(s);
        if (s > hourEnd) setHourEnd(s);
      }}>
        <SelectTrigger className="h-6 w-[64px] text-[10px] border-border text-foreground gap-1 px-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-border max-h-[260px]">
          {Array.from({ length: 24 }, (_, h) => (
            <SelectItem key={h} value={String(h)} className="text-[11px]">
              {`${String(h).padStart(2, "0")}:00`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-[10px] text-muted-foreground">→</span>
      <Select value={String(hourEnd)} onValueChange={(v) => {
        const e = parseInt(v, 10);
        setHourEnd(e);
        if (e < hourStart) setHourStart(e);
      }}>
        <SelectTrigger className="h-6 w-[64px] text-[10px] border-border text-foreground gap-1 px-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-border max-h-[260px]">
          {Array.from({ length: 24 }, (_, h) => (
            <SelectItem key={h} value={String(h)} className="text-[11px]">
              {`${String(h).padStart(2, "0")}:59`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(hourStart !== 0 || hourEnd !== 23) && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => { setHourStart(0); setHourEnd(23); }}
          title="Limpar faixa horária"
        >
          ×
        </Button>
      )}
      <div className="flex flex-wrap items-center gap-1 ml-1">
        {[
          { l: "Madrugada", s: 0, e: 5 },
          { l: "Manhã", s: 6, e: 11 },
          { l: "Tarde", s: 12, e: 17 },
          { l: "Noite", s: 18, e: 23 },
          { l: "Comercial", s: 6, e: 17 },
        ].map((p) => {
          const active = hourStart === p.s && hourEnd === p.e;
          return (
            <Button
              key={p.l}
              size="sm"
              variant={active ? "default" : "outline"}
              className={cn(
                "h-6 px-2 text-[10px] font-medium",
                active ? "" : "border-border text-muted-foreground hover:text-foreground"
              )}
              onClick={() => { setHourStart(p.s); setHourEnd(p.e); }}
              title={`${String(p.s).padStart(2, "0")}:00 – ${String(p.e).padStart(2, "0")}:59`}
            >
              {p.l}
            </Button>
          );
        })}
      </div>
    </div>
  );

  if (!status) return null;
  const { station, listeners } = status;
  const stationLogoSrc = getStationLogoSrc(station.id, station.logoUrl);

  const rawChartData = viewMode === "horario" ? filteredHourlyData : viewMode === "dia" ? dailyData : monthlyData;
  const chartData = factor !== 1
    ? rawChartData.map(d => ({ ...d, listeners: Math.round(d.listeners * factor) }))
    : rawChartData;

  // Apply factor to blend data; for "horario" sub-view also apply hour-range filter
  const displayBlendData = (() => {
    const base = factor !== 1
      ? blendData.map(row => {
          const newRow: Record<string, any> = { time: row.time };
          stations.forEach(st => {
            newRow[st.id] = row[st.id] != null ? Math.round(row[st.id] * factor) : null;
          });
          return newRow;
        })
      : blendData;
    if (viewMode === "blend" && blendView === "horario") {
      return base.filter(row => {
        const h = parseInt(String(row.time).slice(0, 2), 10);
        return Number.isFinite(h) && h >= hourStart && h <= hourEnd;
      });
    }
    return base;
  })();
  const dayName = DAY_SHORT[getBrasiliaDay()];

  // Streaming & Simulado averages for single-station views
  const streamingAvg = chartData.length > 0 ? calcAvg(chartData.filter(d => d.listeners > 0).map(d => d.listeners)) : 0;
  const simuladoAvg = simulatorEnabled && factor !== 1 ? streamingAvg : 0;

  // Unified Download menu (PNG / PDF-W / PDF-B)
  const DownloadMenu = ({ pngRef, pngFilename, className = "" }: { pngRef?: React.RefObject<HTMLDivElement>; pngFilename?: string; className?: string }) => (
    <div data-export-hide="true" className={cn("flex items-center", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px] border-border text-muted-foreground hover:text-foreground"
            disabled={isExporting}
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Formato</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {pngRef && pngFilename && (
            <DropdownMenuItem onClick={() => handleSavePng(pngRef, pngFilename)} className="text-xs cursor-pointer">
              <Download className="h-3.5 w-3.5 mr-2" /> PNG
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => handleExportPdf('light')} disabled={isExporting} className="text-xs cursor-pointer">
            <FileText className="h-3.5 w-3.5 mr-2" /> PDF-W <span className="ml-auto text-[9px] text-muted-foreground">claro</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportPdf('dark')} disabled={isExporting} className="text-xs cursor-pointer">
            <FileText className="h-3.5 w-3.5 mr-2" /> PDF-B <span className="ml-auto text-[9px] text-muted-foreground">escuro</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Comparativo rows for single-station charts
  const ComparativoInfo = () => {
    if (viewMode === "blend") return null;
    if (!simulatorEnabled || factor === 1) return null;
    const rawData = viewMode === "horario" ? filteredHourlyData : viewMode === "dia" ? dailyData : viewMode === "mes" ? monthlyData : [];
    const rawAvg = rawData.length > 0 ? calcAvg(rawData.filter(d => d.listeners > 0).map(d => d.listeners)) : 0;
    const simAvg = Math.round(rawAvg * factor);
    
    if (rawAvg === 0) return null;

    return (
      <div className="mt-2 sm:mt-3 rounded-lg bg-secondary/30 p-2 sm:p-3">
        <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5 sm:mb-2">Comparativo</p>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
          <div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">Média Fi FM</p>
            <p className="font-mono font-bold text-primary text-xs sm:text-sm tabular-nums whitespace-nowrap">{simAvg.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </div>
    );
  };

  const dialogContentClass = isFullscreen
    ? "sm:max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none border-0 overflow-y-auto px-3 sm:px-6 pr-8 sm:pr-10"
    : "sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto w-[98vw] sm:w-[95vw] px-3 sm:px-6 pr-8 sm:pr-10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogContentClass, "bg-card border-border")}>
        <div ref={contentRef}>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 sm:gap-3 text-foreground">
              {stationLogoSrc ? (
                <img
                  src={stationLogoSrc}
                  alt={station.name}
                  className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded-lg bg-secondary p-1"
                  width={40}
                  height={40}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <span className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-secondary flex items-center justify-center text-xs text-muted-foreground font-bold">FM</span>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm sm:text-base block truncate">{station.name}</span>
                <span className="block text-xs sm:text-sm font-mono text-muted-foreground font-normal">
                  {station.frequency}
                  {simulatorEnabled && <span className="ml-2 text-accent text-[10px]">Fi {simulatorFactor}</span>}
                </span>
              </div>
              <Button
                data-export-hide="true"
                size="sm"
                variant="outline"
                className="border-border text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Modo Pop-up" : "Tela Cheia"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Compact metrics table */}
          <div className="rounded-lg bg-secondary/30 overflow-hidden my-2 sm:my-3">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] sm:text-[11px]">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-muted-foreground font-medium py-1.5 px-2 uppercase whitespace-nowrap">Emissora</th>
                    <th className="text-center text-muted-foreground font-medium py-1.5 px-2 uppercase whitespace-nowrap">Agora</th>
                    <th className="text-center text-muted-foreground font-medium py-1.5 px-2 uppercase whitespace-nowrap">Pico</th>
                    <th className="text-center text-muted-foreground font-medium py-1.5 px-2 uppercase whitespace-nowrap">Menor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1.5 px-2 text-foreground font-medium truncate max-w-[120px]">{station.name}</td>
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-foreground whitespace-nowrap tabular-nums">{listeners.toLocaleString("pt-BR")}</td>
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      <span className="font-mono font-bold text-accent tabular-nums">{todayStats.peakValue.toLocaleString("pt-BR")}</span>
                      <span className="text-[9px] text-muted-foreground ml-1 hidden sm:inline">às {todayStats.peakTimeStr}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      <span className="font-mono font-bold text-destructive tabular-nums">{todayStats.minValue.toLocaleString("pt-BR")}</span>
                      <span className="text-[9px] text-muted-foreground ml-1 hidden sm:inline">às {todayStats.minTimeStr}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* View mode tabs */}
          <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 mb-2 sm:mb-3 overflow-x-auto" data-export-hide="false">
            {([
              { id: "realtime" as ViewMode, label: "Tempo Real", shortLabel: "Real", icon: Activity },
              { id: "horario" as ViewMode, label: "Horário", shortLabel: "Hora", icon: Clock },
              { id: "dia" as ViewMode, label: "Dia", shortLabel: "Dia", icon: Calendar },
              { id: "mes" as ViewMode, label: "Mês", shortLabel: "Mês", icon: CalendarDays },
              { id: "blend" as ViewMode, label: "Blend", shortLabel: "Blend", icon: Layers },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-medium py-1.5 sm:py-2 px-1.5 sm:px-2 rounded-md transition-colors whitespace-nowrap min-w-0 ${
                  viewMode === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </div>

          {/* Real-time chart */}
          {viewMode === "realtime" && (
            <div ref={realtimeChartRef} className="rounded-lg bg-secondary/30 p-2 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                  Audiência em Tempo Real — {dayName}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap" data-export-hide="true">
                  <DownloadMenu pngRef={realtimeChartRef} pngFilename={`tempo_real_${station.name.replace(/\s+/g, '_')}`} />
                </div>
              </div>

              {/* Zoom selector */}
              <div className="flex items-center gap-2 mb-3" data-export-hide="true">
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
                <div className="overflow-x-auto">
                  <div className="min-w-[320px]">
                    <ResponsiveContainer width="100%" height={isFullscreen ? 350 : 180}>
                      <LineChart data={realtimeData} margin={{ top: 5, right: 12, left: 8, bottom: 5 }}>
                    <ReferenceArea x1="00:00" x2="05:55" fill="hsl(var(--primary))" fillOpacity={0.08} />
                    <ReferenceArea x1="22:00" x2="23:55" fill="hsl(var(--primary))" fillOpacity={0.08} />
                    <XAxis dataKey="time" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} interval={Math.max(Math.floor(120 / zoomInterval) - 1, 0)} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                    <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={56} tickMargin={6} tickFormatter={(v: number) => v.toLocaleString("pt-BR")} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} labelStyle={{ fontWeight: 700, marginBottom: 4 }} formatter={(value: number) => [value?.toLocaleString("pt-BR") ?? "—", "Conexões"]} />
                    <ReferenceLine x="22:00" stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine x="06:00" stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Line type="monotone" dataKey="listeners" name="Conexões" stroke="hsl(160 84% 44%)" strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[180px] sm:h-[220px] text-muted-foreground text-sm">
                  Aguardando dados de hoje...
                </div>
              )}

              <div className="flex items-center gap-2 mt-2 justify-center">
                <div className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/30" />
                <span className="text-[10px] text-muted-foreground">🌙 Madrugada (22h–05h)</span>
              </div>

              <ComparativoInfo />
            </div>
          )}

          {/* Historical charts (horário, dia, mês) */}
          {(viewMode === "horario" || viewMode === "dia" || viewMode === "mes") && (
            <div className="rounded-lg bg-secondary/30 p-2 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                  {viewMode === "horario"
                    ? `Audiência por Horário — ${horarioFilter === "dia" ? (selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Hoje") : horarioFilter === "seg-sex" ? "Seg-Sex" : horarioFilter === "sab-dom" ? "Sáb-Dom" : "Geral"}`
                    : viewMode === "dia"
                    ? "Audiência por Dia da Semana"
                    : "Audiência Média por Mês"}
                </p>
                <DownloadMenu />
              </div>

              {/* Horário filter controls */}
              {viewMode === "horario" && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3" data-export-hide="true">
                  {([
                    { id: "dia" as HorarioFilter, label: "Dia" },
                    { id: "seg-sex" as HorarioFilter, label: "Seg-Sex" },
                    { id: "sab-dom" as HorarioFilter, label: "Sáb-Dom" },
                    { id: "geral" as HorarioFilter, label: "Geral" },
                  ]).map(f => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant={horarioFilter === f.id ? "default" : "outline"}
                      className={`text-[10px] h-6 px-2.5 ${
                        horarioFilter === f.id
                          ? "bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                      onClick={() => setHorarioFilter(f.id)}
                    >
                      {f.label}
                    </Button>
                  ))}

                  {horarioFilter === "dia" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 px-2.5 border-border text-muted-foreground"
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          {selectedDate ? format(selectedDate, "dd/MM") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                          disabled={(date) => date > new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Compare station selector */}
                  <Select
                    value={compareStationId ?? "none"}
                    onValueChange={(v) => setCompareStationId(v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-6 w-auto min-w-[130px] text-[10px] border-border text-muted-foreground gap-1">
                      <GitCompare className="h-3 w-3 shrink-0" />
                      <SelectValue placeholder="Comparar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="none" className="text-[11px]">Sem comparação</SelectItem>
                      {stations.filter(s => s.id !== status?.station.id).map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-[11px]">{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <HourRangeFilter />
                </div>
              )}

              <div className="overflow-x-auto">
                <div className="min-w-[320px]">
                  <ResponsiveContainer width="100%" height={isFullscreen ? 300 : 180}>
                    <BarChart data={viewMode === "horario" && mergedHorarioData ? mergedHorarioData : chartData} margin={{ top: 5, right: 12, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                  <XAxis dataKey="time" tick={{ fill: "hsl(215 12% 50%)", fontSize: 9 }} axisLine={false} tickLine={false} interval={viewMode === "horario" ? 1 : 0} />
                  <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 9 }} axisLine={false} tickLine={false} width={56} tickMargin={6} tickFormatter={(v: number) => v.toLocaleString("pt-BR")} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(220 18% 12%)", border: "1px solid hsl(220 14% 18%)", borderRadius: "8px", color: "hsl(210 20% 92%)", fontSize: 11 }}
                    labelStyle={{ color: "hsl(210 20% 92%)" }}
                    formatter={(value: number, name: string) => {
                      const label = name === "compare" && compareStation ? compareStation.name : name === "listeners" && compareStation ? station.name : "Conexões";
                      return [value?.toLocaleString("pt-BR") ?? "—", label];
                    }}
                  />
                  <Bar dataKey="listeners" name="listeners" fill="hsl(160 84% 44%)" radius={[4, 4, 0, 0]} />
                  {viewMode === "horario" && mergedHorarioData && (
                    <Bar dataKey="compare" name="compare" fill="hsl(210 90% 55%)" radius={[4, 4, 0, 0]} />
                  )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Legend when comparing */}
              {viewMode === "horario" && compareStation && (
                <div className="flex items-center justify-center gap-4 mt-2" data-export-hide="false">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(160 84% 44%)" }} />
                    <span className="text-[10px] text-muted-foreground">{station.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(210 90% 55%)" }} />
                    <span className="text-[10px] text-muted-foreground">{compareStation.name}</span>
                  </div>
                </div>
              )}

              <ComparativoInfo />
            </div>
          )}

          {/* Blend: everything in one ref for full PNG capture */}
          {viewMode === "blend" && (
            <div ref={blendChartRef} className="space-y-4">
              {/* Controls */}
              <div className="rounded-lg bg-secondary/30 p-2 sm:p-4 space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wide">
                    Comparativo — Emissoras
                    {simulatorEnabled && <span className="text-accent text-[10px] font-normal ml-2">Fi {simulatorFactor}</span>}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap" data-export-hide="true">
                    <DownloadMenu pngRef={blendChartRef} pngFilename="blend_comparativo" />
                  </div>
                </div>

                {/* Sub-mode toggle + date picker */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap" data-export-hide="true">
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Visualizar:</span>
                  <Button
                    size="sm"
                    variant={blendView === "horario" ? "default" : "outline"}
                    className={`text-[10px] sm:text-[11px] h-6 sm:h-7 px-2 sm:px-3 ${blendView === "horario" ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                    onClick={() => setBlendView("horario")}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Hora
                  </Button>
                  <Button
                    size="sm"
                    variant={blendView === "dia" ? "default" : "outline"}
                    className={`text-[10px] sm:text-[11px] h-6 sm:h-7 px-2 sm:px-3 ${blendView === "dia" ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                    onClick={() => setBlendView("dia")}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Dia
                  </Button>

                  {blendView === "horario" && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 sm:h-7 px-2 text-[10px] sm:text-[11px] border-border text-muted-foreground hover:text-foreground gap-1"
                          >
                            <CalendarDays className="h-3 w-3" />
                            {format(blendDate, "dd/MM/yyyy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-card border-border z-50" align="start">
                          <CalendarPicker
                            mode="single"
                            selected={blendDate}
                            onSelect={(d) => { if (d) setBlendDate(d); }}
                            locale={ptBR}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                            disabled={(date) => date > new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 sm:h-7 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const prev = new Date(blendDate);
                          prev.setDate(prev.getDate() - 1);
                          setBlendDate(prev);
                        }}
                      >
                        ◀ Anterior
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 sm:h-7 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const next = new Date(blendDate);
                          next.setDate(next.getDate() + 1);
                          if (next <= new Date()) setBlendDate(next);
                        }}
                      >
                        Próximo ▶
                      </Button>
                      <span className="text-muted-foreground/50">|</span>
                      <HourRangeFilter />
                    </>
                  )}
                </div>

                {/* Station legend with checkboxes */}
                <div data-export-hide="true" className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 px-1">
                  {stations.map((st, i) => (
                    <label key={st.id} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={blendVisibleStations.has(st.id)}
                        onCheckedChange={() => toggleBlendStation(st.id)}
                        className="h-3.5 w-3.5"
                      />
                      <div
                        className="w-2.5 h-[3px] rounded-full shrink-0"
                        style={{ backgroundColor: STATION_COLORS[i % STATION_COLORS.length] }}
                      />
                      <span className="text-[10px] sm:text-[11px] text-foreground font-medium truncate">{st.name}</span>
                    </label>
                  ))}
                </div>

                {/* Chart */}
                {displayBlendData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="min-w-[320px]">
                      <ResponsiveContainer width="100%" height={isFullscreen ? 350 : 220}>
                        <LineChart data={displayBlendData} margin={{ top: 10, right: 12, left: 8, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: "hsl(215 12% 50%)", fontSize: 10 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} interval={blendView === "horario" ? 2 : 0} />
                      <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 10 }} axisLine={false} tickLine={false} width={60} tickMargin={6} tickFormatter={(v: number) => v.toLocaleString("pt-BR")} />
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
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                    Carregando dados comparativos...
                  </div>
                )}
              </div>

              {/* Hourly numeric table */}
              {blendView === "horario" && displayBlendData.length > 0 && (
                <div className="rounded-lg bg-secondary/30 p-2 sm:p-4">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5 px-2 sm:px-0">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Audiência por Horário — {format(blendDate, "dd/MM/yyyy")}
                    {simulatorEnabled && <span className="text-accent text-[10px] font-normal ml-1">(Fi {simulatorFactor})</span>}
                  </p>
                  <div className="overflow-x-auto -mx-2 sm:mx-0 scrollbar-thin">
                    <table className="w-full text-[9px] sm:text-[10px] border-collapse min-w-[800px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-muted-foreground font-medium py-1.5 pr-1 sm:pr-2 sticky left-0 z-10 bg-secondary/95 backdrop-blur-sm min-w-[100px] sm:min-w-[140px]">Emissora</th>
                          {Array.from({ length: 24 }, (_, h) => h).filter(h => h >= hourStart && h <= hourEnd).map(h => (
                            <th key={h} className="text-center text-muted-foreground font-medium py-1.5 px-0.5 sm:px-1 whitespace-nowrap" style={{ minWidth: '30px' }}>
                              {`${String(h).padStart(2, "0")}h`}
                            </th>
                          ))}
                          <th className="text-center text-accent font-bold py-1.5 px-0.5 sm:px-1 min-w-[36px] sm:min-w-[40px] border-l border-accent/30" style={{ whiteSpace: 'nowrap' }}>Média</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blendStations.map((st, idx) => {
                          const globalIdx = stations.findIndex(s => s.id === st.id);
                          const color = STATION_COLORS[globalIdx % STATION_COLORS.length];
                          const stationVals = Array.from({ length: 24 }, (_, h) => h).filter(h => h >= hourStart && h <= hourEnd).map(h => {
                            const row = displayBlendData.find(r => r.time === `${String(h).padStart(2, "0")}:00`);
                            return row?.[st.id];
                          }).filter((v): v is number => v != null && v > 0);
                          const stationAvg = calcAvg(stationVals);
                          
                          return (
                            <tr key={st.id} className="border-b border-border/30 hover:bg-secondary/50 transition-colors">
                              <td className="py-1 sm:py-1.5 pr-1 sm:pr-2 sticky left-0 z-10 bg-secondary/95 backdrop-blur-sm">
                                <div className="flex items-center gap-1" style={{ whiteSpace: 'nowrap' }}>
                                  <span className="text-muted-foreground font-mono text-[8px] sm:text-[10px]">{idx + 1}°</span>
                                  <span
                                    className="inline-block w-1 h-3 sm:h-3.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: color }}
                                    aria-hidden="true"
                                  />
                                  {getStationLogoSrc(st.id, st.logoUrl) ? (
                                    <img src={getStationLogoSrc(st.id, st.logoUrl)} alt="" className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded object-contain shrink-0" />
                                  ) : (
                                    <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded bg-muted flex items-center justify-center text-[6px] text-muted-foreground shrink-0">FM</span>
                                  )}
                                  <span className="text-foreground font-medium text-[8px] sm:text-[10px]">{st.name}</span>
                                </div>
                              </td>
                              {Array.from({ length: 24 }, (_, h) => h).filter(h => h >= hourStart && h <= hourEnd).map(h => {
                                const row = displayBlendData.find(r => r.time === `${String(h).padStart(2, "0")}:00`);
                                const val = row?.[st.id];
                                return (
                                  <td key={h} className="text-center py-1 sm:py-1.5 px-0.5 sm:px-1 font-mono tabular-nums">
                                    <span className={val != null && val > 0 ? "text-foreground" : "text-muted-foreground/40"}>
                                      {val != null && val > 0 ? val.toLocaleString("pt-BR") : "–"}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="text-center py-1 sm:py-1.5 px-0.5 sm:px-1 font-mono tabular-nums font-bold border-l border-accent/30">
                                <span className={stationAvg > 0 ? "text-accent" : "text-muted-foreground/40"}>
                                  {stationAvg > 0 ? stationAvg.toLocaleString("pt-BR") : "–"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Média Fi FM row */}
                        <tr className="bg-primary/5">
                          <td className="py-1.5 sm:py-2 pr-1 sm:pr-2 sticky left-0 z-10 bg-primary/5 backdrop-blur-sm">
                            <div className="flex items-center gap-1">
                              <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary shrink-0" />
                              <span className="text-primary font-bold text-[8px] sm:text-[10px]">Média {simulatorEnabled ? 'Fi' : 'Geral'} FM</span>
                            </div>
                          </td>
                          {Array.from({ length: 24 }, (_, h) => h).filter(h => h >= hourStart && h <= hourEnd).map(h => {
                            const row = displayBlendData.find(r => r.time === `${String(h).padStart(2, "0")}:00`);
                            const vals = blendStations.map(st => row?.[st.id]).filter((v): v is number => v != null && v > 0);
                            const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                            return (
                              <td key={h} className="text-center py-1.5 sm:py-2 px-0.5 sm:px-1 font-mono tabular-nums font-bold">
                                <span className={avg != null ? "text-primary" : "text-muted-foreground/40"}>
                                  {avg != null ? avg.toLocaleString("pt-BR") : "–"}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-center py-1.5 sm:py-2 px-0.5 sm:px-1 font-mono tabular-nums font-bold border-l border-accent/30">
                            {(() => {
                              const allVals = Array.from({ length: 24 }, (_, h) => h).filter(h => h >= hourStart && h <= hourEnd).map(h => {
                                const row = displayBlendData.find(r => r.time === `${String(h).padStart(2, "0")}:00`);
                                const vals = blendStations.map(st => row?.[st.id]).filter((v): v is number => v != null && v > 0);
                                return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                              }).filter((v): v is number => v != null);
                              const avg = calcAvg(allVals);
                              return <span className={avg > 0 ? "text-primary" : "text-muted-foreground/40"}>{avg > 0 ? avg.toLocaleString("pt-BR") : "–"}</span>;
                            })()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center mt-2">
            {viewMode === "realtime" ? "Dados de hoje • Atualização a cada 30s" : viewMode === "blend" ? "Comparativo de emissoras selecionadas" : "Dados reais • Média dos últimos 90 dias"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
