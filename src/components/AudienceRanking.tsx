import { useState, useEffect, useMemo } from "react";
import { StationStatus } from "@/hooks/useStationMonitor";
import { Trophy, Clock, Calendar, CalendarRange, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaHour, getBrasiliaDay, getBrasiliaMonthIndex, getBrasiliaYear, formatBrasiliaDateInput } from "@/lib/brasiliaTime";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from "recharts";

interface Props {
  statuses: StationStatus[];
}

interface SnapshotData {
  station_id: string;
  listeners: number;
  hour: number;
  recorded_at: string;
}

const DAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const STATION_COLORS = [
  "hsl(var(--primary))",
  "#f97316", "#10b981", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1",
];

type TabType = "ranking" | "horario" | "dia" | "mes";
type ZoomInterval = 3 | 5;

export function AudienceRanking({ statuses }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ranking");
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [zoomInterval, setZoomInterval] = useState<ZoomInterval>(5);

  useEffect(() => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("audience_snapshots")
      .select("station_id, listeners, hour, recorded_at")
      .gte("recorded_at", cutoff)
      .order("recorded_at", { ascending: true })
      .then(({ data }) => {
        if (data) setSnapshots(data);
      });
  }, []);

  // Ranking uses live data
  const ranked = [...statuses]
    .map((s) => ({ ...s, rankValue: s.listeners }))
    .filter((s) => s.rankValue > 0)
    .sort((a, b) => b.rankValue - a.rankValue);

  // Real-time chart data: today's snapshots grouped by N-minute intervals
  const chartData = useMemo(() => {
    const todayStr = formatBrasiliaDateInput();
    const todaySnaps = snapshots.filter(
      (snap) => formatBrasiliaDateInput(new Date(snap.recorded_at)) === todayStr
    );

    // Build time slots for every N minutes of the day
    const intervalMin = zoomInterval;
    const slots: { time: string; minuteOfDay: number; [stationId: string]: number | string }[] = [];

    for (let m = 0; m < 24 * 60; m += intervalMin) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const label = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      slots.push({ time: label, minuteOfDay: m });
    }

    // Group snapshots into intervals per station
    const stationIds = statuses.map((s) => s.station.id);
    for (const slot of slots) {
      const slotStart = slot.minuteOfDay;
      const slotEnd = slotStart + intervalMin;

      for (const sid of stationIds) {
        const matching = todaySnaps.filter((snap) => {
          if (snap.station_id !== sid) return false;
          const d = new Date(snap.recorded_at);
          const brasiliaStr = d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
          const b = new Date(brasiliaStr);
          const snapMinute = b.getHours() * 60 + b.getMinutes();
          return snapMinute >= slotStart && snapMinute < slotEnd;
        });

        if (matching.length > 0) {
          const avg = Math.round(matching.reduce((sum, s) => sum + s.listeners, 0) / matching.length);
          (slot as any)[sid] = avg;
        }
      }
    }

    // Filter to only slots that have at least one station with data, plus current time context
    const now = new Date();
    const brasiliaStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const bNow = new Date(brasiliaStr);
    const currentMinute = bNow.getHours() * 60 + bNow.getMinutes();

    return slots.filter((slot) => {
      if (slot.minuteOfDay > currentMinute + intervalMin) return false;
      const hasData = stationIds.some((sid) => (slot as any)[sid] !== undefined);
      return hasData || slot.minuteOfDay <= currentMinute;
    });
  }, [snapshots, statuses, zoomInterval]);

  // Get station name/color mapping for chart
  const stationMeta = useMemo(() => {
    return statuses.map((s, i) => ({
      id: s.station.id,
      name: s.station.name.replace(/ NATAL/gi, "").replace(/DE /gi, "").trim(),
      color: STATION_COLORS[i % STATION_COLORS.length],
    }));
  }, [statuses]);

  const getDailyData = () => {
    return statuses.map((s) => {
      const dayData = [0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
        const daySnaps = snapshots.filter((snap) => {
          const d = getBrasiliaDay(new Date(snap.recorded_at));
          return snap.station_id === s.station.id && d === dayIdx;
        });
        if (daySnaps.length === 0) {
          const currentDay = getBrasiliaDay();
          return { day: dayIdx, avg: currentDay === dayIdx ? s.listeners : 0, count: currentDay === dayIdx ? 1 : 0 };
        }
        const avg = Math.round(daySnaps.reduce((sum, snap) => sum + snap.listeners, 0) / daySnaps.length);
        return { day: dayIdx, avg, count: daySnaps.length };
      });
      const total = dayData.reduce((sum, dd) => sum + dd.avg, 0);
      return { station: s.station, dayData, total };
    }).sort((a, b) => b.total - a.total);
  };

  const getMonthlyData = () => {
    const now = new Date();
    const currentMonth = getBrasiliaMonthIndex(now);
    const currentYear = getBrasiliaYear(now);

    const months: { month: number; year: number; label: string }[] = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      months.push({
        month: d.getMonth(),
        year: d.getFullYear(),
        label: `${MONTH_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      });
    }

    return {
      months,
      rows: statuses.map((s) => {
        const monthData = months.map((m) => {
          const monthSnaps = snapshots.filter((snap) => {
            if (snap.station_id !== s.station.id) return false;
            const rd = new Date(snap.recorded_at);
            return getBrasiliaMonthIndex(rd) === m.month && getBrasiliaYear(rd) === m.year;
          });

          if (monthSnaps.length === 0) {
            if (m.month === currentMonth && m.year === currentYear) {
              return { avg: s.listeners, count: 1 };
            }
            return { avg: 0, count: 0 };
          }

          const byDay = new Map<number, number[]>();
          monthSnaps.forEach((snap) => {
            const dayKey = new Date(snap.recorded_at).getDate();
            if (!byDay.has(dayKey)) byDay.set(dayKey, []);
            byDay.get(dayKey)!.push(snap.listeners);
          });

          const dailyAvgs = Array.from(byDay.values()).map(
            (vals) => Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          );
          const avg = Math.round(dailyAvgs.reduce((a, b) => a + b, 0) / dailyAvgs.length);

          return { avg, count: monthSnaps.length };
        });

        const total = monthData.reduce((sum, md) => sum + md.avg, 0);
        return { station: s.station, monthData, total };
      }).sort((a, b) => b.total - a.total),
    };
  };

  const tabs: { id: TabType; label: string; icon: typeof Trophy }[] = [
    { id: "ranking", label: "Ranking", icon: Trophy },
    { id: "horario", label: "Tempo Real", icon: Clock },
    { id: "dia", label: "Dia", icon: Calendar },
    { id: "mes", label: "Mês", icon: CalendarRange },
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

  const dayName = DAY_SHORT[getBrasiliaDay()];

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
                    <p className="font-mono font-bold text-sm text-foreground">{s.rankValue.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">conexões</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* REAL-TIME CHART TAB */}
      {activeTab === "horario" && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" />
              Audiência Tempo Real
            </h2>
            <span className="text-[10px] text-muted-foreground uppercase">{dayName} — Hoje</span>
          </div>

          {/* Zoom selector */}
          <div className="flex items-center gap-2 mb-4">
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

          {/* Chart */}
          <div className="w-full" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                {/* Madrugada zones: 00:00-05:59 and 22:00-23:59 */}
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
                  formatter={(value: number, name: string) => [value?.toLocaleString("pt-BR") ?? "—", name]}
                />

                {/* Reference lines for madrugada boundaries */}
                <ReferenceLine x="22:00" stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine x="06:00" stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />

                {stationMeta.map((sm) => (
                  <Line
                    key={sm.id}
                    type="monotone"
                    dataKey={sm.id}
                    name={sm.name}
                    stroke={sm.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Madrugada legend */}
          <div className="flex items-center gap-2 mt-2 justify-center">
            <div className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/30" />
            <span className="text-[10px] text-muted-foreground">🌙 Madrugada (22h–05h)</span>
          </div>
        </>
      )}

      {/* DAILY TAB */}
      {activeTab === "dia" && (
        <>
          <h2 className="font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-accent" />
            Audiência por Dia
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-2 font-semibold text-muted-foreground sticky left-0 bg-card">Emissora</th>
                  {DAY_SHORT.map((d, i) => (
                    <th key={i} className="text-center py-2 px-1.5 font-semibold text-muted-foreground min-w-[45px]">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getDailyData().map((row, idx) => (
                  <tr key={row.station.id} className={`border-b border-border/50 ${idx < 3 ? "bg-secondary/30" : ""}`}>
                    {renderStationCell(row.station, idx)}
                    {row.dayData.map((dd) => (
                      <td key={dd.day} className={`text-center py-2 px-1.5 font-mono ${dd.avg > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {dd.avg > 0 ? dd.avg.toLocaleString("pt-BR") : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MONTHLY TAB */}
      {activeTab === "mes" && (() => {
        const { months, rows } = getMonthlyData();
        return (
          <>
            <h2 className="font-display font-bold text-foreground flex items-center gap-2 mb-4">
              <CalendarRange className="h-5 w-5 text-accent" />
              Audiência por Mês
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-2 font-semibold text-muted-foreground sticky left-0 bg-card">Emissora</th>
                    {months.map((m) => (
                      <th key={m.label} className="text-center py-2 px-1.5 font-semibold text-muted-foreground min-w-[55px]">
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.station.id} className={`border-b border-border/50 ${idx < 3 ? "bg-secondary/30" : ""}`}>
                      {renderStationCell(row.station, idx)}
                      {row.monthData.map((md, mi) => (
                        <td key={mi} className={`text-center py-2 px-1.5 font-mono ${md.avg > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                          {md.avg > 0 ? md.avg.toLocaleString("pt-BR") : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}
    </div>
  );
}
