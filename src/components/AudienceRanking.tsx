import { useState } from "react";
import { StationStatus } from "@/hooks/useStationMonitor";
import { Trophy, Clock, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  statuses: StationStatus[];
}

const TIME_SLOTS = ["Todos", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

export function AudienceRanking({ statuses }: Props) {
  const [selectedTime, setSelectedTime] = useState("Todos");

  const ranked = [...statuses]
    .map((s) => {
      if (selectedTime === "Todos") {
        return { ...s, rankValue: s.listeners, label: "agora" };
      }
      const historyEntry = s.history.find((h) => h.time === selectedTime);
      return { ...s, rankValue: historyEntry?.listeners ?? 0, label: selectedTime };
    })
    .filter((s) => s.rankValue > 0)
    .sort((a, b) => b.rankValue - a.rankValue);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          Ranking de Audiência
        </h2>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <Clock className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Time filter */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {TIME_SLOTS.map((slot) => (
          <Button
            key={slot}
            size="sm"
            variant={selectedTime === slot ? "default" : "outline"}
            className={`text-[11px] h-7 px-2.5 ${
              selectedTime === slot
                ? "bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setSelectedTime(slot)}
          >
            {slot}
          </Button>
        ))}
      </div>

      {/* Ranking list */}
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
                  {s.station.name}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground">{s.station.frequency}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-sm text-foreground">
                  {s.rankValue.toLocaleString("pt-BR")}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">conexões</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
