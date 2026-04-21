import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, AlertCircle, RefreshCw, FileWarning, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-logs`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function SystemLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "error" | "warning">("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("auth_token");
      const res = await fetch(FUNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: API_KEY },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = filter === "all" ? logs : logs.filter(l => l.level === filter);
  const errorCount = logs.filter(l => l.level === "error").length;
  const warnCount = logs.filter(l => l.level === "warning").length;

  const levelIcon = (level: string) => {
    if (level === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    if (level === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    return <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  };

  const levelBadge = (level: string) => {
    if (level === "error") return <Badge variant="destructive" className="text-[9px] px-1.5 py-0">ERRO</Badge>;
    if (level === "warning") return <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-500 border-amber-500/30">AVISO</Badge>;
    return <Badge variant="outline" className="text-[9px] px-1.5 py-0">INFO</Badge>;
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return ts; }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-primary" />
          Logs do Sistema
          {errorCount > 0 && <Badge variant="destructive" className="text-[10px]">{errorCount} erros</Badge>}
          {warnCount > 0 && <Badge className="text-[10px] bg-amber-500/20 text-amber-500 border-amber-500/30">{warnCount} avisos</Badge>}
        </h2>
        <div className="flex items-center gap-1">
          {(["all", "error", "warning"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              className="h-6 text-[10px] px-2"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Todos" : f === "error" ? "Erros" : "Avisos"}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-6 w-6 p-0 ml-1" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">{loading ? "Carregando..." : "Nenhum log encontrado"}</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1">
          {filtered.map((log, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                log.level === "error" ? "bg-destructive/5 border border-destructive/20" :
                log.level === "warning" ? "bg-amber-500/5 border border-amber-500/20" :
                "bg-secondary/30 border border-border"
              }`}
            >
              {levelIcon(log.level)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {levelBadge(log.level)}
                  <span className="text-[10px] text-muted-foreground font-mono">{formatTime(log.timestamp)}</span>
                  <span className="text-[10px] text-primary/70 font-medium">{log.source}</span>
                </div>
                <p className="text-foreground mt-0.5 break-words">{log.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
