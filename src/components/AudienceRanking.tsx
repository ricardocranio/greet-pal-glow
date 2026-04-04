import { useState, useEffect } from "react";
import { StationStatus } from "@/hooks/useStationMonitor";
import { Trophy, Clock, Calendar, CalendarRange, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaHour, getBrasiliaDay, getBrasiliaMonthIndex, getBrasiliaYear } from "@/lib/brasiliaTime";

interface Props {
  statuses: StationStatus[];
}

interface SnapshotData {
  station_id: string;
  listeners: number;
  hour: number;
  recorded_at: string;
}

const ALL_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const VISIBLE_HOURS_COUNT = 5;
const DAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

type TabType = "ranking" | "horario" | "dia" | "mes";

export function AudienceRanking({ statuses }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ranking");
  const [selectedTime, setSelectedTime] = useState("Todos");
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [hoursExpanded, setHoursExpanded] = useState(false);

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

  const TIME_SLOTS = ["Todos", ...ALL_HOURS.map((h) => `${String(h).padStart(2, "0")}:00`)];
  const hoursWithData = new Set(snapshots.map((s) => s.hour));

  const ranked = [...statuses]
    .map((s) => {
      if (selectedTime === "Todos") return { ...s, rankValue: s.listeners, label: "agora" };
      const selectedHour = parseInt(selectedTime.split(":")[0]);
      const hourSnaps = snapshots.filter(
        (snap) => snap.station_id === s.station.id && snap.hour === selectedHour
      );
      const avg = hourSnaps.length > 0
        ? Math.round(hourSnaps.reduce((sum, snap) => sum + snap.listeners, 0) / hourSnaps.length)
        : 0;
      return { ...s, rankValue: avg, label: selectedTime };
    })
    .filter((s) => s.rankValue > 0)
    .sort((a, b) => b.rankValue - a.rankValue);

  const getHourlyData = () => {
    return statuses.map((s) => {
      const hourData = ALL_HOURS.map((h) => {
        const hourSnaps = snapshots.filter((snap) => snap.station_id === s.station.id && snap.hour === h);
        if (hourSnaps.length === 0) {
          const currentHour = getBrasiliaHour();
          return { hour: h, avg: currentHour === h ? s.listeners : 0, count: currentHour === h ? 1 : 0 };
        }
        const avg = Math.round(hourSnaps.reduce((sum, snap) => sum + snap.listeners, 0) / hourSnaps.length);
        return { hour: h, avg, count: hourSnaps.length };
      });
      const total = hourData.reduce((sum, hd) => sum + hd.avg, 0);
      return { station: s.station, hourData, total };
    }).sort((a, b) => b.total - a.total);
  };

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

  // Monthly data: sum daily averages per month (last 3 months + current)
  const getMonthlyData = () => {
    const now = new Date();
    const currentMonth = getBrasiliaMonthIndex(now);
    const currentYear = getBrasiliaYear(now);

    // Build list of last 4 months (including current)
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
            // If it's the current month, use live data
            if (m.month === currentMonth && m.year === currentYear) {
              return { avg: s.listeners, count: 1 };
            }
            return { avg: 0, count: 0 };
          }

          // Group by day to get daily averages, then sum
          const byDay = new Map<number, number[]>();
          monthSnaps.forEach((snap) => {
            const dayKey = new Date(snap.recorded_at).getDate();
            if (!byDay.has(dayKey)) byDay.set(dayKey, []);
            byDay.get(dayKey)!.push(snap.listeners);
          });

          // Average per day, then average across days
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

  const visibleSlots = hoursExpanded
    ? TIME_SLOTS
    : TIME_SLOTS.slice(0, VISIBLE_HOURS_COUNT + 1);

  const tabs: { id: TabType; label: string; icon: typeof Trophy }[] = [
    { id: "ranking", label: "Ranking", icon: Trophy },
    { id: "horario", label: "Horário", icon: Clock },
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
          </div>

          <div className="mb-4">
            <div className="flex flex-wrap gap-1.5">
              {visibleSlots.map((slot) => {
                const slotHour = slot === "Todos" ? -1 : parseInt(slot.split(":")[0]);
                const hasData = slot === "Todos" ? snapshots.length > 0 : hoursWithData.has(slotHour);
                return (
                  <Button
                    key={slot}
                    size="sm"
                    variant={selectedTime === slot ? "default" : "outline"}
                    className={`text-[11px] h-7 px-2.5 relative ${
                      selectedTime === slot
                        ? "bg-primary text-primary-foreground"
                        : hasData
                          ? "border-primary/50 text-foreground hover:text-foreground"
                          : "border-border text-muted-foreground/50 hover:text-foreground"
                    }`}
                    onClick={() => setSelectedTime(slot)}
                  >
                    {hasData && selectedTime !== slot && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                    )}
                    {slot}
                  </Button>
                );
              })}

              <Button
                size="sm"
                variant="ghost"
                className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setHoursExpanded(!hoursExpanded)}
              >
                {hoursExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 mr-1" />
                    Recolher
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    +{TIME_SLOTS.length - visibleSlots.length} horários
                  </>
                )}
              </Button>
            </div>
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

      {/* HOURLY TAB */}
      {activeTab === "horario" && (
        <>
          <h2 className="font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-accent" />
            Audiência por Horário
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-2 font-semibold text-muted-foreground sticky left-0 bg-card">Emissora</th>
                  {ALL_HOURS.map((h) => (
                    <th key={h} className="text-center py-2 px-1 font-mono font-semibold text-muted-foreground min-w-[40px]">
                      {String(h).padStart(2, "0")}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getHourlyData().map((row, idx) => (
                  <tr key={row.station.id} className={`border-b border-border/50 ${idx < 3 ? "bg-secondary/30" : ""}`}>
                    {renderStationCell(row.station, idx)}
                    {row.hourData.map((hd) => (
                      <td key={hd.hour} className={`text-center py-2 px-1 font-mono ${hd.avg > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {hd.avg > 0 ? hd.avg.toLocaleString("pt-BR") : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
