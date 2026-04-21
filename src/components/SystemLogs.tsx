import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, AlertCircle, RefreshCw, FileWarning, Info, CheckCircle2, Trash2, ChevronDown, ChevronUp, Lightbulb, HelpCircle, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  reason?: string;
  fix?: string;
}

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-logs`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function SystemLogs({ externalLogs = [] }: { externalLogs?: LogEntry[] }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

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
      else if (data.error) {
        console.warn("System logs error:", data.error);
        setLogs([]);
      }
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const clearLogs = async () => {
    setClearing(true);
    try {
      const token = sessionStorage.getItem("auth_token");
      await fetch(FUNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: API_KEY },
        body: JSON.stringify({ token, action: "clear" }),
      });
      setLogs([]);
      setExpandedIdx(null);
    } catch (e) {
      console.error("Failed to clear logs:", e);
    } finally {
      setClearing(false);
    }
  };

  // Merge external logs with server logs
  const allLogs = [...externalLogs, ...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const filtered = filter === "all" ? allLogs : allLogs.filter(l => l.level === filter);
  const errorCount = allLogs.filter(l => l.level === "error").length;
  const warnCount = allLogs.filter(l => l.level === "warning").length;
  const infoCount = allLogs.filter(l => l.level === "info").length;

  const levelIcon = (level: string, source?: string) => {
    if (source === "Autenticação") {
      if (level === "info") return <LogIn className="h-3.5 w-3.5 text-primary shrink-0" />;
      if (level === "warning") return <User className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    }
    if (level === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    if (level === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    if (level === "info") return <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />;
    return <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  };

  const levelBadge = (level: string, source?: string) => {
    if (source === "Autenticação") {
      if (level === "info") return <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-500 border-emerald-500/30">LOGIN</Badge>;
      if (level === "warning") return <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-500 border-amber-500/30">AUTH</Badge>;
      if (level === "error") return <Badge variant="destructive" className="text-[9px] px-1.5 py-0">AUTH ERRO</Badge>;
    }
    if (level === "error") return <Badge variant="destructive" className="text-[9px] px-1.5 py-0">ERRO</Badge>;
    if (level === "warning") return <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-500 border-amber-500/30">AVISO</Badge>;
    if (level === "info") return <Badge className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">INFO</Badge>;
    return <Badge variant="outline" className="text-[9px] px-1.5 py-0">LOG</Badge>;
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return ts; }
  };

  const hasDetails = (log: LogEntry) => !!(log.reason || log.fix);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-primary" />
          Logs do Sistema
          {errorCount > 0 && <Badge variant="destructive" className="text-[10px]">{errorCount}</Badge>}
          {warnCount > 0 && <Badge className="text-[10px] bg-amber-500/20 text-amber-500 border-amber-500/30">{warnCount}</Badge>}
          {infoCount > 0 && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">{infoCount}</Badge>}
        </h2>
        <div className="flex items-center gap-1">
          {(["all", "error", "warning", "info"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              className="h-6 text-[10px] px-2"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Todos" : f === "error" ? "Erros" : f === "warning" ? "Avisos" : "Info"}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-6 w-6 p-0 ml-1" onClick={fetchLogs} disabled={loading} title="Atualizar">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {allLogs.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive" title="Limpar logs">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todos os logs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso irá apagar permanentemente todos os registros de eventos (logins, erros, avisos) das últimas 24 horas. Os diagnósticos em tempo real (emissoras offline, validações) continuarão aparecendo normalmente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={clearLogs} disabled={clearing}>
                    {clearing ? "Limpando..." : "Limpar tudo"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">{loading ? "Carregando..." : "Nenhum log encontrado"}</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
          {filtered.map((log, i) => {
            const isExpanded = expandedIdx === i;
            const details = hasDetails(log);
            return (
              <div
                key={`${log.timestamp}-${i}`}
                className={`rounded-lg px-2.5 py-1.5 text-xs transition-all ${
                  log.level === "error" ? "bg-destructive/5 border border-destructive/20" :
                  log.level === "warning" ? "bg-amber-500/5 border border-amber-500/20" :
                  log.source === "Autenticação" && log.level === "info" ? "bg-emerald-500/5 border border-emerald-500/20" :
                  log.level === "info" ? "bg-primary/5 border border-primary/20" :
                  "bg-secondary/30 border border-border"
                }`}
              >
                <div
                  className={`flex items-start gap-2 ${details ? "cursor-pointer" : ""}`}
                  onClick={() => details && setExpandedIdx(isExpanded ? null : i)}
                >
                  {levelIcon(log.level, log.source)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {levelBadge(log.level, log.source)}
                      <span className="text-[10px] text-muted-foreground font-mono">{formatTime(log.timestamp)}</span>
                      <span className="text-[10px] text-primary/70 font-medium">{log.source}</span>
                    </div>
                    <p className="text-foreground mt-0.5 break-words">{log.message}</p>
                  </div>
                  {details && (
                    <div className="shrink-0 mt-0.5">
                      {isExpanded
                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </div>
                  )}
                </div>

                {isExpanded && details && (
                  <div className="mt-2 ml-5 space-y-1.5 border-t border-border/50 pt-2">
                    {log.reason && (
                      <div className="flex items-start gap-1.5">
                        <HelpCircle className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Causa</span>
                          <p className="text-foreground/80 text-[11px] mt-0.5">{log.reason}</p>
                        </div>
                      </div>
                    )}
                    {log.fix && (
                      <div className="flex items-start gap-1.5">
                        <Lightbulb className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-semibold text-amber-500 uppercase">Solução</span>
                          <p className="text-foreground/80 text-[11px] mt-0.5">{log.fix}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
