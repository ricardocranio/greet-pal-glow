import { useState, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Radio, Lock, User, Eye, EyeOff } from "lucide-react";
import natalSplash from "@/assets/natal-splash.jpg";

import { toast } from "sonner";

interface LoginGateProps {
  children: ReactNode;
}

export function LoginGate({ children }: LoginGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("auth_token");
    if (token) {
      setAuthenticated(true);
    }
    setChecking(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        toast.error(data?.error || "Credenciais inválidas");
        return;
      }

      sessionStorage.setItem("auth_token", data.token);
      sessionStorage.setItem("auth_username", data.username);
      sessionStorage.setItem("auth_role", data.role);
      setShowSplash(true);
      setTimeout(() => {
        setAuthenticated(true);
        setShowSplash(false);
      }, 2000);
      toast.success(`Bem-vindo, ${data.username}!`);
    } catch {
      toast.error("Erro ao conectar ao servidor");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Radio className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 bg-background animate-fade-in">
        <img
          src={natalSplash}
          alt="Natal/RN"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Radio className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="font-display font-bold text-xl text-foreground">
            Monitoramento de Audiência
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Rádios de Natal/RN</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10"
                autoFocus
                disabled={loading}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-[10px] text-muted-foreground/60 text-center mt-6">
          by Ricardo Amaral
        </p>
      </div>
    </div>
  );
}
