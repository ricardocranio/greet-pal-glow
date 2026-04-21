import { useState, useEffect, useCallback, useRef } from "react";
import { Radio, Plus, Pencil, Trash2, X, Check, Image, ToggleLeft, ToggleRight, Upload, Play, MapPin, ChevronDown, ChevronRight, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface DbStation {
  id: string;
  name: string;
  frequency: string;
  stream_url: string;
  logo_url: string;
  category: string;
  display_order: number;
  active: boolean;
  praca_id: string | null;
}

interface Praca {
  id: string;
  name: string;
  state: string;
  active: boolean;
  created_by_display: string;
  created_at: string;
}

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callApi(body: Record<string, unknown>) {
  const token = sessionStorage.getItem("auth_token");
  const res = await fetch(FUNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: API_KEY },
    body: JSON.stringify({ ...body, token }),
  });
  return res.json();
}

function isValidStreamUrl(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function StreamUrlInput({ value, onChange, onTest, className }: {
  value: string;
  onChange: (v: string) => void;
  onTest?: () => void;
  className?: string;
}) {
  const valid = isValidStreamUrl(value);
  return (
    <div className={`flex gap-1 ${className || ""}`}>
      <Input
        placeholder="URL do Stream"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-sm h-8 flex-1 ${!valid && value ? "border-destructive" : ""}`}
      />
      {onTest && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2 shrink-0"
          onClick={onTest}
          title="Testar stream"
          disabled={!valid}
        >
          <Play className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function testStream(url: string) {
  if (!isValidStreamUrl(url) || !url.trim()) {
    toast.error("URL inválida");
    return;
  }
  const audio = new Audio();
  const timeout = setTimeout(() => {
    audio.pause();
    audio.src = "";
    toast.error("Stream não respondeu (timeout 8s)");
  }, 8000);

  audio.addEventListener("canplay", () => {
    clearTimeout(timeout);
    audio.pause();
    audio.src = "";
    toast.success("✅ Stream funcionando!");
  }, { once: true });

  audio.addEventListener("error", () => {
    clearTimeout(timeout);
    toast.error("❌ Não foi possível conectar ao stream");
  }, { once: true });

  audio.src = url.trim();
  audio.load();
  toast.info("Testando stream...");
}

function LogoUpload({ stationId, currentUrl, onUploaded }: {
  stationId: string;
  currentUrl: string;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await callApi({
          action: "upload_logo",
          station_id: stationId,
          file_name: file.name,
          file_base64: base64,
          content_type: file.type,
        });
        if (res.error) {
          toast.error(res.error);
        } else if (res.url) {
          onUploaded(res.url);
          toast.success("Logo enviada!");
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Erro ao enviar logo");
      setUploading(false);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      {currentUrl ? (
        <img src={currentUrl} alt="" className="h-10 w-10 rounded object-contain bg-background border border-border" />
      ) : (
        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center border border-border">
          <Image className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="h-3.5 w-3.5 mr-1" />
        {uploading ? "Enviando..." : "Upload Logo"}
      </Button>
    </div>
  );
}

type BackupStep = "idle" | "starting" | "exporting" | "done" | "error";

export default function StationManager({ onPracasChanged, onBackupLog }: { onPracasChanged?: () => void; onBackupLog?: (entry: { format: string; pracas: number; stations: number }) => void } = {}) {
  const [stations, setStations] = useState<DbStation[]>([]);
  const [pracas, setPracas] = useState<Praca[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPraca, setExpandedPraca] = useState<string | null>(null);

  const [backupOpen, setBackupOpen] = useState(false);
  const [backupStep, setBackupStep] = useState<BackupStep>("idle");
  const [backupFormat, setBackupFormat] = useState<"csv" | "json">("csv");

  const [showPracaForm, setShowPracaForm] = useState(false);
  const [newPracaName, setNewPracaName] = useState("");
  const [newPracaState, setNewPracaState] = useState("");
  const [addingPraca, setAddingPraca] = useState(false);

  const [editingPracaId, setEditingPracaId] = useState<string | null>(null);
  const [editPracaName, setEditPracaName] = useState("");
  const [editPracaState, setEditPracaState] = useState("");

  const [showStationFormFor, setShowStationFormFor] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newFrequency, setNewFrequency] = useState("");
  const [newStreamUrl, setNewStreamUrl] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newCategory, setNewCategory] = useState("commercial");
  const [newOrder, setNewOrder] = useState("100");
  const [addingStation, setAddingStation] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [editStreamUrl, setEditStreamUrl] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editCategory, setEditCategory] = useState("commercial");
  const [editOrder, setEditOrder] = useState("100");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [stRes, prRes] = await Promise.all([
      callApi({ action: "list_stations" }),
      callApi({ action: "list_pracas" }),
    ]);
    if (stRes.stations) setStations(stRes.stations);
    if (prRes.pracas) setPracas(prRes.pracas);
    setLoading(false);
    onPracasChanged?.();
  }, [onPracasChanged]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAddPraca = async () => {
    if (!newPracaName.trim()) { toast.error("Nome obrigatório"); return; }
    setAddingPraca(true);
    const res = await callApi({ action: "add_praca", name: newPracaName, state: newPracaState });
    if (res.error) toast.error(res.error);
    else {
      toast.success("Praça criada!");
      setNewPracaName(""); setNewPracaState(""); setShowPracaForm(false);
      fetchAll();
    }
    setAddingPraca(false);
  };

  const handleDeletePraca = async (praca: Praca) => {
    const stationsInPraca = stations.filter(s => s.praca_id === praca.id);
    if (!confirm(`Excluir a praça "${praca.name}"? ${stationsInPraca.length} emissora(s) serão desvinculadas.`)) return;
    const res = await callApi({ action: "delete_praca", praca_id: praca.id });
    if (res.error) toast.error(res.error);
    else { toast.success("Praça excluída"); fetchAll(); }
  };

  const startEditPraca = (praca: Praca) => {
    setEditingPracaId(praca.id);
    setEditPracaName(praca.name);
    setEditPracaState(praca.state);
  };

  const handleSaveEditPraca = async () => {
    if (!editingPracaId || !editPracaName.trim()) { toast.error("Nome obrigatório"); return; }
    const res = await callApi({ action: "edit_praca", praca_id: editingPracaId, name: editPracaName.trim(), state: editPracaState.trim() });
    if (res.error) toast.error(res.error);
    else { toast.success("Praça atualizada!"); setEditingPracaId(null); fetchAll(); }
  };

  const resetStationForm = () => {
    setNewId(""); setNewName(""); setNewFrequency(""); setNewStreamUrl("");
    setNewLogoUrl(""); setNewCategory("commercial"); setNewOrder("100");
    setShowStationFormFor(null);
  };

  const handleAddStation = async (pracaId: string) => {
    if (!newId.trim() || !newName.trim()) { toast.error("ID e nome obrigatórios"); return; }
    if (!isValidStreamUrl(newStreamUrl)) { toast.error("URL do stream inválida (use http ou https)"); return; }
    setAddingStation(true);
    const res = await callApi({
      action: "add_station",
      id: newId.trim(),
      name: newName.trim(),
      frequency: newFrequency.trim(),
      stream_url: newStreamUrl.trim(),
      logo_url: newLogoUrl.trim(),
      category: newCategory,
      display_order: parseInt(newOrder) || 100,
      praca_id: pracaId,
    });
    if (res.error) toast.error(res.error);
    else { toast.success("Emissora adicionada!"); resetStationForm(); fetchAll(); }
    setAddingStation(false);
  };

  const handleDelete = async (station: DbStation) => {
    if (!confirm(`Excluir "${station.name}"?`)) return;
    const res = await callApi({ action: "delete_station", station_id: station.id });
    if (res.error) toast.error(res.error);
    else { toast.success("Emissora excluída"); fetchAll(); }
  };

  const handleToggleActive = async (station: DbStation) => {
    const res = await callApi({ action: "edit_station", station_id: station.id, active: !station.active });
    if (res.error) toast.error(res.error);
    else { toast.success(station.active ? `${station.name} desativada` : `${station.name} ativada`); fetchAll(); }
  };

  const startEdit = (s: DbStation) => {
    setEditingId(s.id); setEditName(s.name); setEditFrequency(s.frequency);
    setEditStreamUrl(s.stream_url); setEditLogoUrl(s.logo_url);
    setEditCategory(s.category); setEditOrder(String(s.display_order));
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!isValidStreamUrl(editStreamUrl)) { toast.error("URL do stream inválida"); return; }
    const res = await callApi({
      action: "edit_station", station_id: editingId,
      name: editName.trim(), frequency: editFrequency.trim(),
      stream_url: editStreamUrl.trim(), logo_url: editLogoUrl.trim(),
      category: editCategory, display_order: parseInt(editOrder) || 100,
    });
    if (res.error) toast.error(res.error);
    else { toast.success("Emissora atualizada!"); setEditingId(null); fetchAll(); }
  };

  const categoryLabel = (cat: string) => {
    const map: Record<string, { label: string; className: string }> = {
      commercial: { label: "Comercial", className: "bg-primary/20 text-primary border-primary/30" },
      religious: { label: "Religiosa", className: "bg-accent/20 text-accent border-accent/30" },
      state: { label: "Estatal", className: "bg-muted text-muted-foreground border-border" },
    };
    const m = map[cat] || map.commercial;
    return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
  };

  const runBackup = useCallback(async (format: "csv" | "json") => {
    setBackupFormat(format);
    setBackupOpen(true);
    setBackupStep("starting");

    await new Promise(r => setTimeout(r, 400));
    setBackupStep("exporting");

    try {
      const now = new Date();
      const ts = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(/[/:]/g, "-").replace(/ /g, "_");

      if (format === "json") {
        const payload = {
          exportedAt: now.toISOString(),
          exportedBy: sessionStorage.getItem("auth_display") || sessionStorage.getItem("auth_user") || "admin",
          pracas: pracas.map(p => ({
            ...p,
            stations: stations.filter(s => s.praca_id === p.id),
          })),
          orphanStations: stations.filter(s => !s.praca_id),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `backup_pracas_emissoras_${ts}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const lines: string[] = [];
        lines.push("Praça,UF,Emissora ID,Emissora Nome,Frequência,Stream URL,Categoria,Ordem,Ativa,Criado por,Criado em");
        pracas.forEach(p => {
          const pStations = stations.filter(s => s.praca_id === p.id);
          if (pStations.length === 0) {
            lines.push(`"${p.name}","${p.state}","","(sem emissoras)","","","","","","${p.created_by_display}","${new Date(p.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}"`);
          } else {
            pStations.forEach(s => {
              lines.push(`"${p.name}","${p.state}","${s.id}","${s.name}","${s.frequency}","${s.stream_url}","${s.category}","${s.display_order}","${s.active ? "Sim" : "Não"}","${p.created_by_display}","${new Date(p.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}"`);
            });
          }
        });
        stations.filter(s => !s.praca_id).forEach(s => {
          lines.push(`"(sem praça)","","${s.id}","${s.name}","${s.frequency}","${s.stream_url}","${s.category}","${s.display_order}","${s.active ? "Sim" : "Não"}","",""`);
        });
        const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `backup_pracas_emissoras_${ts}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      await new Promise(r => setTimeout(r, 300));
      setBackupStep("done");
      onBackupLog?.({ format, pracas: pracas.length, stations: stations.length });
    } catch {
      setBackupStep("error");
    }
  }, [stations, pracas, onBackupLog]);

  const stationsByPraca = (pracaId: string) => stations.filter(s => s.praca_id === pracaId);
  const orphanStations = stations.filter(s => !s.praca_id);

  const renderStation = (s: DbStation) => (
    <div key={s.id} className={`rounded-lg px-3 py-2.5 border ${!s.active ? "border-muted bg-muted/20 opacity-60" : "border-border bg-secondary/30"}`}>
      {editingId === s.id ? (
        <div className="space-y-2">
          <LogoUpload
            stationId={s.id}
            currentUrl={editLogoUrl}
            onUploaded={(url) => { setEditLogoUrl(url); }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Nome" value={editName} onChange={(e) => setEditName(e.target.value)} className="text-sm h-8" />
            <Input placeholder="Frequência" value={editFrequency} onChange={(e) => setEditFrequency(e.target.value)} className="text-sm h-8" />
            <StreamUrlInput value={editStreamUrl} onChange={setEditStreamUrl} onTest={() => testStream(editStreamUrl)} />
            <Input placeholder="URL Logo (ou use upload)" value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} className="text-sm h-8" />
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="commercial">Comercial</SelectItem>
                <SelectItem value="religious">Religiosa</SelectItem>
                <SelectItem value="state">Estatal</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Ordem" value={editOrder} onChange={(e) => setEditOrder(e.target.value)} className="text-sm h-8" type="number" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground mr-auto">ID: {s.id}</span>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setEditingId(null)}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSaveEdit}>
              <Check className="h-3.5 w-3.5 mr-1" /> Salvar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {s.logo_url ? (
              <img src={s.logo_url} alt="" className="h-8 w-8 rounded object-contain bg-background shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                <Image className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                {categoryLabel(s.category)}
                {!s.active && <Badge variant="outline" className="text-[10px] border-muted">Inativa</Badge>}
              </div>
              <span className="text-[11px] text-muted-foreground">{s.frequency} · {s.id} · Ordem: {s.display_order}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => startEdit(s)} title="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 ${s.active ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"}`} onClick={() => handleToggleActive(s)} title={s.active ? "Desativar" : "Ativar"}>
              {s.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(s)} title="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderStationForm = (pracaId: string) => (
    <div className="mt-2 p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
      <p className="text-xs font-medium text-foreground mb-1">Nova Emissora</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input placeholder="ID único (ex: radio99fm) *" value={newId} onChange={(e) => setNewId(e.target.value)} className="text-sm h-8" />
        <Input placeholder="Nome da Rádio *" value={newName} onChange={(e) => setNewName(e.target.value)} className="text-sm h-8" />
        <Input placeholder="Frequência (ex: 99,9 MHz)" value={newFrequency} onChange={(e) => setNewFrequency(e.target.value)} className="text-sm h-8" />
        <StreamUrlInput value={newStreamUrl} onChange={setNewStreamUrl} onTest={() => testStream(newStreamUrl)} />
        <Input placeholder="URL Logo (ou use upload após criar)" value={newLogoUrl} onChange={(e) => setNewLogoUrl(e.target.value)} className="text-sm h-8" />
        <Select value={newCategory} onValueChange={setNewCategory}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="commercial">Comercial</SelectItem>
            <SelectItem value="religious">Religiosa</SelectItem>
            <SelectItem value="state">Estatal</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Ordem (ex: 1)" value={newOrder} onChange={(e) => setNewOrder(e.target.value)} className="text-sm h-8" type="number" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={() => handleAddStation(pracaId)} disabled={addingStation}>
          {addingStation ? "Adicionando..." : "Adicionar"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={resetStationForm}>
          Cancelar
        </Button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">Carregando...</p>
    </div>
  );

  const stepLabel = (step: BackupStep) => {
    if (step === "starting") return "Iniciando backup...";
    if (step === "exporting") return `Exportando ${backupFormat.toUpperCase()} (${pracas.length} praças, ${stations.length} emissoras)...`;
    if (step === "done") return "✅ Backup concluído!";
    if (step === "error") return "❌ Erro no backup";
    return "";
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <Dialog open={backupOpen} onOpenChange={(o) => { if (!o) { setBackupOpen(false); setBackupStep("idle"); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Backup Praças & Emissoras</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(["starting", "exporting", "done", "error"] as BackupStep[]).map((s) => {
              const isActive = s === backupStep;
              const isPast = (["starting", "exporting", "done", "error"].indexOf(backupStep) > ["starting", "exporting", "done", "error"].indexOf(s));
              return (
                <div key={s} className={`flex items-center gap-3 text-sm ${isActive ? "text-foreground font-medium" : isPast ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isActive ? "bg-primary text-primary-foreground animate-pulse" :
                    isPast ? "bg-primary/30 text-primary" : "bg-muted"
                  }`}>
                    {isPast ? "✓" : s === "starting" ? "1" : s === "exporting" ? "2" : s === "done" ? "3" : "!"}
                  </div>
                  <span>{stepLabel(s === "error" && backupStep !== "error" ? "done" : s)}</span>
                </div>
              );
            })}
          </div>
          {backupStep === "done" && (
            <Button size="sm" className="w-full" onClick={() => { setBackupOpen(false); setBackupStep("idle"); }}>
              Fechar
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Praças & Emissoras
        </h2>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="border-border text-muted-foreground" disabled={stations.length === 0 && pracas.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Backup <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => runBackup("csv")}>
                📄 CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runBackup("json")}>
                📋 JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={fetchAll} className="border-border text-muted-foreground" title="Atualizar praças">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowPracaForm(!showPracaForm)} className="border-border text-muted-foreground">
            <Plus className="h-4 w-4 mr-1" /> Nova Praça
          </Button>
        </div>
      </div>

      {showPracaForm && (
        <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
          <p className="text-xs font-medium text-foreground">Nova Praça</p>
          <div className="flex gap-2">
            <Input placeholder="Cidade *" value={newPracaName} onChange={(e) => setNewPracaName(e.target.value)} className="text-sm h-8 flex-1" />
            <Input placeholder="UF (ex: RN)" value={newPracaState} onChange={(e) => setNewPracaState(e.target.value)} className="text-sm h-8 w-24" maxLength={2} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAddPraca} disabled={addingPraca}>
              {addingPraca ? "Criando..." : "Criar Praça"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setShowPracaForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {pracas.map((praca) => {
        const pStations = stationsByPraca(praca.id);
        const isExpanded = expandedPraca === praca.id;
        return (
          <div key={praca.id} className="border border-border rounded-lg overflow-hidden">
            {editingPracaId === praca.id ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/40">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <Input placeholder="Cidade" value={editPracaName} onChange={(e) => setEditPracaName(e.target.value)} className="text-sm h-7 flex-1" />
                <Input placeholder="UF" value={editPracaState} onChange={(e) => setEditPracaState(e.target.value)} className="text-sm h-7 w-16" maxLength={2} />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditingPracaId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" className="h-7 w-7 p-0" onClick={handleSaveEditPraca}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                className="flex items-center justify-between w-full px-3 py-2.5 bg-secondary/40 hover:bg-secondary/60 transition-colors text-left"
                onClick={() => setExpandedPraca(isExpanded ? null : praca.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{praca.name}</span>
                  {praca.state && <span className="text-xs text-muted-foreground">/{praca.state.toUpperCase()}</span>}
                  <Badge variant="outline" className="text-[10px] border-border">{pStations.length} emissoras</Badge>
                  {praca.created_by_display && (
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      por {praca.created_by_display} · {new Date(praca.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => startEditPraca(praca)} title="Editar praça">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePraca(praca)} title="Excluir praça">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </button>
            )}

            {isExpanded && (
              <div className="p-3 space-y-2">
                {pStations.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">Nenhuma emissora nesta praça.</p>
                ) : (
                  pStations.map(renderStation)
                )}
                {showStationFormFor === praca.id ? (
                  renderStationForm(praca.id)
                ) : (
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs border-dashed" onClick={() => setShowStationFormFor(praca.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Emissora
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {orphanStations.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2.5 bg-secondary/40">
            <span className="text-sm font-medium text-muted-foreground">Sem praça vinculada ({orphanStations.length})</span>
          </div>
          <div className="p-3 space-y-2">
            {orphanStations.map(renderStation)}
          </div>
        </div>
      )}
    </div>
  );
}
