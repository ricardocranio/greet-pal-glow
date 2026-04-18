import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Users, Shield, ShieldCheck, Eye, UserPlus, Ban, Trash2, LogOut as LogOutIcon, ArrowLeft, RefreshCw, Wifi, Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
const HistoryViewer = lazy(() => import("@/components/HistoryViewer"));
const BackupManager = lazy(() => import("@/components/BackupManager"));

interface AppUser {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
  blocked: boolean;
  created_at: string;
}

interface ActiveSession {
  username: string;
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

const roleBadge = (role: string) => {
  const map: Record<string, { label: string; className: string }> = {
    admin: { label: "Admin", className: "bg-primary/20 text-primary border-primary/30" },
    editor: { label: "Editor", className: "bg-accent/20 text-accent border-accent/30" },
    viewer: { label: "Viewer", className: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[role] || map.viewer;
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("viewer");

  const userRole = sessionStorage.getItem("auth_role");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const data = await callApi({ action: "list" });
    if (data.users) setUsers(data.users);
    if (data.sessions) setSessions(data.sessions);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userRole !== "admin") {
      navigate("/");
      return;
    }
    fetchUsers();
  }, [userRole, navigate, fetchUsers]);

  const isOnline = (username: string) => sessions.some((s) => s.username === username);

  const handleAdd = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error("Usuário e senha são obrigatórios");
      return;
    }
    setAdding(true);
    const res = await callApi({
      action: "add",
      username: newUsername.trim(),
      password: newPassword.trim(),
      display_name: newDisplayName.trim() || newUsername.trim(),
      role: newRole,
    });
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Usuário criado!");
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setNewRole("viewer");
      fetchUsers();
    }
    setAdding(false);
  };

  const handleToggleBlock = async (user: AppUser) => {
    const res = await callApi({ action: "toggle_block", user_id: user.id, blocked: !user.blocked });
    if (res.error) toast.error(res.error);
    else {
      toast.success(user.blocked ? `${user.display_name} desbloqueado` : `${user.display_name} bloqueado`);
      fetchUsers();
    }
  };

  const handleKick = async (username: string) => {
    const res = await callApi({ action: "kick", username });
    if (res.error) toast.error(res.error);
    else {
      toast.success("Sessão encerrada");
      fetchUsers();
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (!confirm(`Excluir o usuário "${user.display_name}"? Esta ação não pode ser desfeita.`)) return;
    const res = await callApi({ action: "delete", user_id: user.id });
    if (res.error) toast.error(res.error);
    else {
      toast.success("Usuário excluído");
      fetchUsers();
    }
  };

  const startEdit = (user: AppUser) => {
    setEditingId(user.id);
    setEditDisplayName(user.display_name || "");
    setEditPassword("");
    setEditRole(user.role);
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (userId: string) => {
    const res = await callApi({
      action: "edit",
      user_id: userId,
      display_name: editDisplayName.trim(),
      password: editPassword.trim() || undefined,
      role: editRole,
    });
    if (res.error) toast.error(res.error);
    else {
      toast.success("Usuário atualizado!");
      setEditingId(null);
      fetchUsers();
    }
  };

  if (userRole !== "admin") return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Users className="h-5 w-5 text-primary" />
            <h1 className="font-display font-bold text-lg text-foreground">Gerenciar Usuários</h1>
          </div>
          <Button size="sm" variant="outline" onClick={fetchUsers} className="border-border text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Historical data viewer */}
        <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando histórico…</div>}>
          <HistoryViewer />
        </Suspense>

        {/* Automatic backups */}
        <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando backups…</div>}>
          <BackupManager />
        </Suspense>

        {/* Connected users */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-display font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
            <Wifi className="h-4 w-4 text-primary" />
            Usuários Conectados ({sessions.length})
          </h2>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum usuário conectado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sessions.map((s) => (
                <div key={s.username} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm text-foreground font-medium">{s.username}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleKick(s.username)} title="Desconectar">
                    <LogOutIcon className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add user */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-display font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
            <UserPlus className="h-4 w-4 text-primary" />
            Adicionar Usuário
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Usuário *" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            <Input placeholder="Senha *" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Input placeholder="Nome de exibição" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="mt-3" onClick={handleAdd} disabled={adding}>
            {adding ? "Criando..." : "Criar Usuário"}
          </Button>
        </div>

        {/* Users list */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-display font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-primary" />
            Todos os Usuários ({users.length})
          </h2>
          {loading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className={`rounded-lg px-3 py-2.5 border ${u.blocked ? "border-destructive/30 bg-destructive/5" : "border-border bg-secondary/30"}`}>
                  {editingId === u.id ? (
                    /* Edit mode */
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input placeholder="Nome de exibição" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="text-sm h-8" />
                        <Input placeholder="Nova senha (vazio = manter)" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="text-sm h-8" />
                        <Select value={editRole} onValueChange={setEditRole}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground mr-auto">@{u.username}</span>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={cancelEdit}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                        </Button>
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(u.id)}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isOnline(u.username) ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{u.display_name || u.username}</span>
                            {roleBadge(u.role)}
                            {u.blocked && <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>}
                          </div>
                          <span className="text-[11px] text-muted-foreground">@{u.username}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => startEdit(u)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 ${u.blocked ? "text-primary hover:bg-primary/10" : "text-accent hover:bg-accent/10"}`} onClick={() => handleToggleBlock(u)} title={u.blocked ? "Desbloquear" : "Bloquear"}>
                          {u.blocked ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                        </Button>
                        {isOnline(u.username) && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-accent hover:bg-accent/10" onClick={() => handleKick(u.username)} title="Desconectar">
                            <LogOutIcon className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(u)} title="Excluir">
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
      </main>
    </div>
  );
}
