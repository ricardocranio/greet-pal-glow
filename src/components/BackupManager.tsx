import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BackupRow {
  id: string;
  file_name: string;
  period_start: string;
  period_end: string;
  rows_exported: number;
  file_size_bytes: number;
  created_at: string;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function BackupManager() {
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("backup_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) toast.error("Erro ao carregar backups");
    else setBackups(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateNow = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-backup");
      if (error) throw error;
      toast.success(`Backup gerado: ${data.rows_exported} registros`);
      await load();
    } catch (e) {
      toast.error("Falha ao gerar backup");
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const download = async (fileName: string) => {
    setDownloading(fileName);
    try {
      const { data, error } = await supabase.storage
        .from("audience-backups")
        .createSignedUrl(fileName, 60);
      if (error || !data?.signedUrl) throw error;
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = fileName;
      a.click();
    } catch (e) {
      toast.error("Falha ao baixar arquivo");
      console.error(e);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          Backups Automáticos ({backups.length})
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={generateNow} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Gerar agora
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Backups semanais em CSV são gerados automaticamente toda segunda-feira às 03:00 (Brasília). Mantidos por 90 dias.
      </p>

      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-6">Carregando…</div>
      ) : backups.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          Nenhum backup gerado ainda. Clique em "Gerar agora" para criar o primeiro.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 font-medium">Gerado em</th>
                <th className="text-left py-2 font-medium">Período</th>
                <th className="text-right py-2 font-medium">Registros</th>
                <th className="text-right py-2 font-medium">Tamanho</th>
                <th className="text-right py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 tabular-nums">{formatDate(b.created_at)}</td>
                  <td className="py-2 tabular-nums">{b.period_start} → {b.period_end}</td>
                  <td className="py-2 text-right tabular-nums">{b.rows_exported.toLocaleString("pt-BR")}</td>
                  <td className="py-2 text-right tabular-nums">{formatBytes(b.file_size_bytes)}</td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => download(b.file_name)}
                      disabled={downloading === b.file_name}
                    >
                      {downloading === b.file_name
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
