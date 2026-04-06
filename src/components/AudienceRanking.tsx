import { useState, useEffect, useMemo } from "react";
import { StationStatus } from "@/hooks/useStationMonitor";
import { Trophy, Clock, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaHour } from "@/lib/brasiliaTime";
import { stations } from "@/data/stations";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatBrasiliaDateInput } from "@/lib/brasiliaTime";

interface Props {
  statuses: StationStatus[];
}

interface SnapshotData {
  station_id: string;
  listeners: number;
  hour: number;
  recorded_at: string;
}

const STATION_COLORS = [
  "hsl(160 84% 44%)", "hsl(210 90% 55%)", "hsl(340 75% 55%)", "hsl(45 90% 50%)",
  "hsl(280 70% 55%)", "hsl(20 85% 55%)", "hsl(180 60% 45%)", "hsl(120 50% 45%)",
  "hsl(0 70% 55%)", "hsl(240 60% 60%)",
];

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type TabType = "ranking" | "horario" | "blend";
type BlendView = "horario" | "dia";

export function AudienceRanking({ statuses }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ranking");
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [blendView, setBlendView] = useState<BlendView>("horario");

  useEffect(() => {
    async function fetchAll() {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const allData: SnapshotData[] = [];
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
      setSnapshots(allData);
    }
    fetchAll();
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
      const hourData = Array.from({ length: 16 }, (_, i) => i + 7).map((h) => {
        const hourSnaps = stationSnaps.filter((snap) => snap.hour === h);
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
  }, [statuses, snapshotsByStation]);

  const blendData = useMemo(() => {
    if (snapshots.length === 0) return [];

    if (blendView === "horario") {
      const todayStr = formatBrasiliaDateInput();
      const todaySnaps = snapshots.filter(s => formatBrasiliaDateInput(new Date(s.recorded_at)) === todayStr);
      const hourMap = new Map<number, Map<string, number[]>>();
      todaySnaps.forEach(s => {
        if (!hourMap.has(s.hour)) hourMap.set(s.hour, new Map());
        const stMap = hourMap.get(s.hour)!;
        if (!stMap.has(s.station_id)) stMap.set(s.station_id, []);
        stMap.get(s.station_id)!.push(s.listeners);
      });
      return Array.from({ length: 24 }, (_, h) => {
        const row: Record<string, any> = { time: `${String(h).padStart(2, "0")}:00` };
        const stMap = hourMap.get(h);
        stations.forEach(st => {
          const vals = stMap?.get(st.id) || [];
          row[st.id] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        });
        return row;
      });
    } else {
      const dayMap = new Map<number, Map<string, number[]>>();
      snapshots.forEach(s => {
        const dt = new Date(new Date(s.recorded_at).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const d = dt.getDay();
        if (!dayMap.has(d)) dayMap.set(d, new Map());
        const stMap = dayMap.get(d)!;
        if (!stMap.has(s.station_id)) stMap.set(s.station_id, []);
        stMap.get(s.station_id)!.push(s.listeners);
      });
      return [0, 1, 2, 3, 4, 5, 6].map(d => {
        const row: Record<string, any> = { time: DAY_NAMES[d] };
        const stMap = dayMap.get(d);
        stations.forEach(st => {
          const vals = stMap?.get(st.id) || [];
          row[st.id] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        });
        return row;
      });
    }
  }, [snapshots, blendView]);

  const tabs: { id: TabType; label: string; icon: typeof Trophy }[] = [
    { id: "ranking", label: "Ranking", icon: Trophy },
    { id: "horario", label: "Horário", icon: Clock },
    { id: "blend", label: "Blend", icon: Layers },
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
                  {Array.from({ length: 16 }, (_, i) => i + 7).map((h) => (
                    <th key={h} className="text-center py-2 px-1 font-semibold text-muted-foreground min-w-[35px]">
                      {String(h).padStart(2, "0")}h
                    </th>
                  ))}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* BLEND TAB */}
      {activeTab === "blend" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-accent" />
              Comparativo
            </h2>
          </div>

          {/* Sub-mode toggle */}
          <div className="flex items-center gap-2">
            <button
              className={`text-[11px] font-medium py-1.5 px-3 rounded-md transition-colors ${
                blendView === "horario"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/30 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setBlendView("horario")}
            >
              <Clock className="h-3 w-3 inline mr-1" />
              Por Hora (Hoje)
            </button>
            <button
              className={`text-[11px] font-medium py-1.5 px-3 rounded-md transition-colors ${
                blendView === "dia"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/30 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setBlendView("dia")}
            >
              Por Dia
            </button>
          </div>

          {/* Station legend */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-1">
            {stations.map((st, i) => (
              <div key={st.id} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-[3px] rounded-full shrink-0"
                  style={{ backgroundColor: STATION_COLORS[i % STATION_COLORS.length] }}
                />
                <span className="text-[10px] text-foreground font-medium truncate">{st.name.replace(/ NATAL/gi, "").replace(/DE /gi, "")}</span>
              </div>
            ))}
          </div>

          {/* Chart */}
          {blendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={blendData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "hsl(215 12% 50%)", fontSize: 9 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  interval={blendView === "horario" ? 3 : 0}
                />
                <YAxis
                  tick={{ fill: "hsl(215 12% 50%)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220 18% 10%)",
                    border: "1px solid hsl(220 14% 22%)",
                    borderRadius: "10px",
                    color: "hsl(210 20% 92%)",
                    fontSize: 11,
                    padding: "8px 12px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  }}
                  labelStyle={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    const st = stations.find(s => s.id === name);
                    return [value?.toLocaleString("pt-BR") ?? "—", st?.name ?? name];
                  }}
                  itemSorter={(item: any) => -(item.value || 0)}
                />
                {stations.map((st, i) => (
                  <Line
                    key={st.id}
                    type="monotone"
                    dataKey={st.id}
                    name={st.id}
                    stroke={STATION_COLORS[i % STATION_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    strokeOpacity={0.9}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              Carregando dados comparativos...
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            {blendView === "horario" ? "Dados de hoje" : "Média dos últimos 90 dias"}
          </p>
        </div>
      )}
    </div>
  );
}
