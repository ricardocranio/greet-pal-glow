import { useState, useEffect, useCallback } from "react";
import { Radio, Plus, Pencil, Trash2, X, Check, Image, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface DbStation {
  id: string;
  name: string;
  frequency: string;
  stream_url: string;
  logo_url: string;
  category: string;
  display_order: number;
  active: boolean;
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

export default function StationManager() {
  const [stations, setStations] = useState<DbStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // New station form
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newFrequency, setNewFrequency] = useState("");
  const [newStreamUrl, setNewStreamUrl] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newCategory, setNewCategory] = useState("commercial");
  const [newOrder, setNewOrder] = useState("100");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [editStreamUrl, setEditStreamUrl] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editCategory, setEditCategory] = useState("commercial");
  const [editOrder, setEditOrder] = useState("100");

  const fetchStations = useCallback(async () => {
    setLoading(true);
    const data = await callApi({ action: "list_stations" });
    if (data.stations) setStations(data.stations);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStations(); }, [fetchStations]);

  const handleAdd = async () => {
    if (!newId.trim() || !newName.trim()) {
      toast.error("ID e nome são obrigatórios");
      return;
    }
    setAdding(true);
    const res = await callApi({
      action: "add_station",
      id: newId.trim(),
      name: newName.trim(),
      frequency: newFrequency.trim(),
      stream_url: newStreamUrl.trim(),
      logo_url: newLogoUrl.trim(),
      category: newCategory,
      display_order: parseInt(newOrder) || 100,
    });
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Emissora adicionada!");
      setNewId(""); setNewName(""); setNewFrequency(""); setNewStreamUrl(""); setNewLogoUrl("");
      setNewCategory("commercial"); setNewOrder("100"); setShowForm(false);
      fetchStations();
    }
    setAdding(false);
  };

  const handleDelete = async (station: DbStation) => {
    if (!confirm(`Excluir a emissora "${station.name}"? Os dados históricos serão mantidos.`)) return;
    const res = await callApi({ action: "delete_station", station_id: station.id });
    if (res.error) toast.error(res.error);
    else { toast.success("Emissora excluída"); fetchStations(); }
  };

  const handleToggleActive = async (station: DbStation) => {
    const res = await callApi({ action: "edit_station", station_id: station.id, active: !station.active });
    if (res.error) toast.error(res.error);
    else {
      toast.success(station.active ? `${station.name} desativada` : `${station.name} ativada`);
      fetchStations();
    }
  };

  const startEdit = (s: DbStation) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditFrequency(s.frequency);
    setEditStreamUrl(s.stream_url);
    setEditLogoUrl(s.logo_url);
    setEditCategory(s.category);
    setEditOrder(String(s.display_order));
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const res = await callApi({
      action: "edit_station",
      station_id: editingId,
      name: editName.trim(),
      frequency: editFrequency.trim(),
      stream_url: editStreamUrl.trim(),
      logo_url: editLogoUrl.trim(),
      category: editCategory,
      display_order: parseInt(editOrder) || 100,
    });
    if (res.error) toast.error(res.error);
    else {
      toast.success("Emissora atualizada!");
      setEditingId(null);
      fetchStations();
    }
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

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          Emissoras ({stations.length})
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="border-border text-muted-foreground">
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input placeholder="ID único (ex: radio99fm) *" value={newId} onChange={(e) => setNewId(e.target.value)} className="text-sm h-8" />
            <Input placeholder="Nome *" value={newName} onChange={(e) => setNewName(e.target.value)} className="text-sm h-8" />
            <Input placeholder="Frequência (ex: 99,9 MHz)" value={newFrequency} onChange={(e) => setNewFrequency(e.target.value)} className="text-sm h-8" />
            <Input placeholder="URL do Stream" value={newStreamUrl} onChange={(e) => setNewStreamUrl(e.target.value)} className="text-sm h-8" />
            <Input placeholder="URL do Logo" value={newLogoUrl} onChange={(e) => setNewLogoUrl(e.target.value)} className="text-sm h-8" />
            <div className="flex gap-2">
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-8 text-sm flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial">Comercial</SelectItem>
                  <SelectItem value="religious">Religiosa</SelectItem>
                  <SelectItem value="state">Estatal</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Ordem" value={newOrder} onChange={(e) => setNewOrder(e.target.value)} className="text-sm h-8 w-20" type="number" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={adding}>
              {adding ? "Adicionando..." : "Adicionar"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Stations list */}
      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {stations.map((s) => (
            <div key={s.id} className={`rounded-lg px-3 py-2.5 border ${!s.active ? "border-muted bg-muted/20 opacity-60" : "border-border bg-secondary/30"}`}>
              {editingId === s.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input placeholder="Nome" value={editName} onChange={(e) => setEditName(e.target.value)} className="text-sm h-8" />
                    <Input placeholder="Frequência" value={editFrequency} onChange={(e) => setEditFrequency(e.target.value)} className="text-sm h-8" />
                    <Input placeholder="URL Stream" value={editStreamUrl} onChange={(e) => setEditStreamUrl(e.target.value)} className="text-sm h-8" />
                    <Input placeholder="URL Logo" value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} className="text-sm h-8" />
                    <Select value={editCategory} onValueChange={setEditCategory}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
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
                      <div className="flex items-center gap-2">
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
          ))}
        </div>
      )}
    </div>
  );
}
