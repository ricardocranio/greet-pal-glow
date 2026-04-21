import { useState, useEffect, useMemo } from "react";
import { StationStatus } from "@/hooks/useStationMonitor";
import { Trophy, Clock, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaHour, formatBrasiliaDateInput } from "@/lib/brasiliaTime";

interface Props {
  statuses: StationStatus[];
}

interface SnapshotData {
  station_id: string;
  listeners: number;
  hour: number;
  recorded_at: string;
}

interface DailyAvgData {
  station_id: string;
  date: string;
  avg_listeners: number;
  peak_listeners: number;
}

type TabType = "ranking" | "horario" | "mensal";

export function AudienceRanking({ statuses }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ranking");
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [dailyAvgs, setDailyAvgs] = useState<DailyAvgData[]>([]);

  useEffect(() => {
    const now = new Date();
    const brasiliaStr = formatBrasiliaDateInput(now);
    const startOfDay = `${brasiliaStr}T00:00:00-03:00`;
    const endOfDay = `${brasiliaStr}T23:59:59-03:00`;

    let cancelled = false;

    async function fetchToday() {
      const allData: SnapshotData[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("audience_snapshots")
          .select("station_id, listeners, hour, recorded_at")
          .gte("recorded_at", startOfDay)
          .lte("recorded_at", endOfDay)
          .order("recorded_at", { ascending: true })
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      if (!cancelled) setSnapshots(allData);
    }

    fetchToday();

    // Realtime: escuta novos snapshots e adiciona incrementalmente (sem re-baixar o dia)
    const channel = supabase
      .channel("audience_snapshots_today")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audience_snapshots" },
        (payload) => {
          const row = payload.new as SnapshotData & { recorded_at: string };
          if (!row?.recorded_at) return;
          // Filtra apenas snapshots de hoje (Brasília)
          if (row.recorded_at < startOfDay || row.recorded_at > endOfDay) return;
          setSnapshots((prev) => [
            ...prev,
            {
              station_id: row.station_id,
              listeners: row.listeners,
              hour: row.hour,
              recorded_at: row.recorded_at,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch daily averages for monthly view
  useEffect(() => {
    async function fetchDailyAvgs() {
      const allData: DailyAvgData[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("daily_averages")
          .select("station_id, date, avg_listeners, peak_listeners")
          .order("date", { ascending: true })
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        allData.push(...(data as DailyAvgData[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setDailyAvgs(allData);
    }
    fetchDailyAvgs();
  }, []);

  const snapshotsByStation = useMemo(() => {
    const map = new Map<string, SnapshotData[]>();
    for (const snap of snapshots) {
      let arr = map.get(snap.station_id);
      if (!arr) { arr = []; map.set(snap.station_id, arr); }
      arr.push(snap);
    }
    return map;
  }, [snapshots]);

  const ranked = useMemo(() =>
    [...statuses]
      .map((s) => ({ ...s, rankValue: s.listeners }))
      .filter((s) => s.rankValue > 0)
      .sort((a, b) => b.rankValue - a.rankValue),
    [statuses]
  );

  const hourlyData = useMemo(() => {
    return statuses.map((s) => {
      const stationSnaps = snapshotsByStation.get(s.station.id) ?? [];
      const currentHourRaw = getBrasiliaHour();
      const currentHour = isNaN(currentHourRaw) ? 0 : Math.max(0, Math.min(23, currentHourRaw));
      const hourData = Array.from({ length: currentHour + 1 }, (_, i) => i).map((h) => {
        const hourSnaps = stationSnaps.filter((snap) => snap.hour === h);
        if (hourSnaps.length === 0) {
          const currentHour = getBrasiliaHour();
          return { hour: h, avg: currentHour === h ? s.listeners : 0, count: currentHour === h ? 1 : 0 };
        }
        const avg = Math.round(hourSnaps.reduce((sum, snap) => sum + snap.listeners, 0) / hourSnaps.length);
        return { hour: h, avg, count: hourSnaps.length };
      });
      const hoursWithData = hourData.filter((hd) => hd.avg > 0);
      const dailyAvg = hoursWithData.length > 0
        ? Math.round(hoursWithData.reduce((sum, hd) => sum + hd.avg, 0) / hoursWithData.length)
        : 0;
      const total = hourData.reduce((sum, hd) => sum + hd.avg, 0);
      return { station: s.station, hourData, total, dailyAvg };
    }).sort((a, b) => b.dailyAvg - a.dailyAvg);
  }, [statuses, snapshotsByStation]);

  // Monthly data from daily_averages
  const monthlyData = useMemo(() => {
    const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    
    // Group by station + month
    const monthlyMap = new Map<string, Map<string, { sum: number; count: number; peak: number; days: { date: string; avg: number }[] }>>();
    const allMonths = new Set<string>();

    for (const row of dailyAvgs) {
      const d = new Date(row.date + "T12:00:00");
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      allMonths.add(monthKey);

      if (!monthlyMap.has(row.station_id)) monthlyMap.set(row.station_id, new Map());
      const stMap = monthlyMap.get(row.station_id)!;
      if (!stMap.has(monthKey)) stMap.set(monthKey, { sum: 0, count: 0, peak: 0, days: [] });
      const entry = stMap.get(monthKey)!;
      entry.sum += row.avg_listeners;
      entry.count += 1;
      entry.peak = Math.max(entry.peak, row.peak_listeners);
      entry.days.push({ date: row.date, avg: row.avg_listeners });
    }

    const sortedMonths = Array.from(allMonths).sort();
    const monthLabels = sortedMonths.map((mk) => {
      const [y, m] = mk.split("-");
      return `${monthNames[parseInt(m) - 1]}/${y.slice(2)}`;
    });

    const stationData = statuses.map((s) => {
      const stMap = monthlyMap.get(s.station.id);
      const months = sortedMonths.map((mk) => {
        const entry = stMap?.get(mk);
        return {
          avg: entry ? Math.round(entry.sum / entry.count) : 0,
          peak: entry?.peak ?? 0,
          days: entry?.days ?? [],
        };
      });
      const totalAvg = months.reduce((sum, m) => sum + m.avg, 0);
      return { station: s.station, months, totalAvg };
    }).sort((a, b) => b.totalAvg - a.totalAvg);

    return { monthLabels, sortedMonths, stationData };
  }, [dailyAvgs, statuses]);

  const tabs: { id: TabType; label: string; icon: typeof Trophy }[] = [
    { id: "ranking", label: "Ranking", icon: Trophy },
    { id: "horario", label: "Horário", icon: Clock },
    { id: "mensal", label: "Mensal", icon: Calendar },
  ];

  const renderStationCell = (station: { logoUrl: string; name: string; frequency?: string }, idx: number) => (
    <td className="py-2 pr-2 font-display font-semibold text-foreground truncate max-w-[120px] sticky left-0 bg-card">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-mono text-[10px] w-4">{idx + 1}º</span>
        <img src={station.logoUrl} alt="" className="h-5 w-5 object-contain rounded shrink-0" width={20} height={20} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <span className="truncate">{station.name.replace(/ NATAL/gi, "").replace(/DE /gi, "")}</span>
      </div>
    </td>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Tab selector */}
      <div className="flex gap-1 mb-4 bg-secondary/30 rounded-lg p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-2 px-2 rounded-md transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* RANKING TAB */}
      {activeTab === "ranking" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              Ranking de Audiência
            </h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">ao vivo</span>
          </div>

          <div className="space-y-2">
            {ranked.map((s, index) => {
              const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
              return (
                <div
                  key={s.station.id}
                  className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors ${
                    index < 3 ? "bg-secondary/60" : "bg-secondary/20"
                  }`}
                >
                  <span className="w-7 text-center font-mono font-bold text-sm text-muted-foreground">
                    {medal ?? `${index + 1}º`}
                  </span>
                  <img
                    src={s.station.logoUrl}
                    alt={s.station.name}
                    className="h-8 w-8 object-contain rounded bg-secondary/80 p-0.5 shrink-0"
                    width={32}
                    height={32}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-semibold text-foreground truncate">
                      {s.station.name.replace(/ NATAL/gi, "").replace(/DE /gi, "")}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">{s.station.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-sm text-foreground tabular-nums whitespace-nowrap">{s.rankValue.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">conexões</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* HOURLY TAB */}
      {activeTab === "horario" && (
        <>
          <h2 className="font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-accent" />
            Audiência por Horário
          </h2>
          <div className="overflow-x-auto">
             <table className="w-full min-w-[980px] text-[11px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-2 font-semibold text-muted-foreground sticky left-0 bg-card">Emissora</th>
                  {Array.from({ length: getBrasiliaHour() + 1 }, (_, i) => i).map((h) => (
                    <th key={h} className="text-center py-2 px-1 font-semibold text-muted-foreground min-w-[35px]">
                      {String(h).padStart(2, "0")}h
                    </th>
                  ))}
                  <th className="text-center py-2 px-1 font-bold text-accent min-w-[45px]">Média</th>
                </tr>
              </thead>
              <tbody>
                {hourlyData.map((row, idx) => (
                  <tr key={row.station.id} className={`border-b border-border/50 ${idx < 3 ? "bg-secondary/30" : ""}`}>
                    {renderStationCell(row.station, idx)}
                    {row.hourData.map((hd) => (
                      <td key={hd.hour} className={`text-center py-2 px-1 font-mono tabular-nums whitespace-nowrap ${hd.avg > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {hd.avg > 0 ? hd.avg.toLocaleString("pt-BR") : "—"}
                      </td>
                    ))}
                    <td className="text-center py-2 px-1 font-mono font-bold text-accent tabular-nums whitespace-nowrap">
                      {row.dailyAvg > 0 ? row.dailyAvg.toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MONTHLY TAB */}
      {activeTab === "mensal" && (
        <>
          <h2 className="font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-accent" />
            Resumo Mensal
          </h2>
          {monthlyData.monthLabels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Dados mensais ainda não disponíveis. As médias diárias são calculadas automaticamente às 23:59.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[11px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-2 font-semibold text-muted-foreground sticky left-0 bg-card">Emissora</th>
                    {monthlyData.monthLabels.map((ml) => (
                      <th key={ml} className="text-center py-2 px-1 font-semibold text-muted-foreground min-w-[50px]" colSpan={2}>
                        {ml}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <th className="sticky left-0 bg-card"></th>
                    {monthlyData.monthLabels.map((ml) => (
                      <>
                        <th key={`${ml}-avg`} className="text-center py-1 px-1 text-[9px] text-muted-foreground/70 min-w-[40px]">Média</th>
                        <th key={`${ml}-peak`} className="text-center py-1 px-1 text-[9px] text-muted-foreground/70 min-w-[40px]">Pico</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.stationData.map((row, idx) => (
                    <tr key={row.station.id} className={`border-b border-border/50 ${idx < 3 ? "bg-secondary/30" : ""}`}>
                      {renderStationCell(row.station, idx)}
                      {row.months.map((m, mi) => (
                        <>
                          <td key={`${mi}-avg`} className={`text-center py-2 px-1 font-mono tabular-nums whitespace-nowrap ${m.avg > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                            {m.avg > 0 ? m.avg.toLocaleString("pt-BR") : "—"}
                          </td>
                          <td key={`${mi}-peak`} className={`text-center py-2 px-1 font-mono tabular-nums whitespace-nowrap ${m.peak > 0 ? "text-accent" : "text-muted-foreground/40"}`}>
                            {m.peak > 0 ? m.peak.toLocaleString("pt-BR") : "—"}
                          </td>
                        </>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
