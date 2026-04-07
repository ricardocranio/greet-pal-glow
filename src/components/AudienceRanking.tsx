import { useState, useEffect, useMemo } from "react";
import { StationStatus } from "@/hooks/useStationMonitor";
import { Trophy, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaHour } from "@/lib/brasiliaTime";

interface Props {
  statuses: StationStatus[];
}

interface SnapshotData {
  station_id: string;
  listeners: number;
  hour: number;
  recorded_at: string;
}


type TabType = "ranking" | "horario";

export function AudienceRanking({ statuses }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ranking");
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);

  useEffect(() => {
    async function fetchToday() {
      // Get today's date in Brasília timezone
      const now = new Date();
      const brasiliaStr = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const startOfDay = `${brasiliaStr}T00:00:00-03:00`;
      const endOfDay = `${brasiliaStr}T23:59:59-03:00`;

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
      setSnapshots(allData);
    }
    fetchToday();
    // Refresh every 5 minutes
    const interval = setInterval(fetchToday, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Pre-index snapshots by station_id for fast lookups
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
      const hourData = Array.from({ length: 24 }, (_, i) => i).map((h) => {
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


  const tabs: { id: TabType; label: string; icon: typeof Trophy }[] = [
    { id: "ranking", label: "Ranking", icon: Trophy },
    { id: "horario", label: "Horário", icon: Clock },
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
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
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
                      <td key={hd.hour} className={`text-center py-2 px-1 font-mono ${hd.avg > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {hd.avg > 0 ? hd.avg.toLocaleString("pt-BR") : "—"}
                      </td>
                    ))}
                    <td className="text-center py-2 px-1 font-mono font-bold text-accent">
                      {row.dailyAvg > 0 ? row.dailyAvg.toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
