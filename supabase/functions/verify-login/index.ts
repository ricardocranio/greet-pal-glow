import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Capture client info for audit logs
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.headers.get("cf-connecting-ip")
    || "desconhecido";
  const userAgent = req.headers.get("user-agent") || "desconhecido";

  async function logEvent(event_type: string, source: string, message: string, username?: string, metadata?: Record<string, unknown>) {
    try {
      await supabase.from("system_events").insert({
        event_type, source, message, username: username || null,
        metadata: { ...metadata, ip: clientIp, user_agent: userAgent },
      });
    } catch (e) {
      console.error("Failed to log event:", e);
    }
  }

  try {
    const { username, password, action, token } = await req.json();

    // Handle logout
    if (action === "logout") {
      if (token) {
        // Get username before deleting session
        const { data: sess } = await supabase
          .from("active_sessions")
          .select("username, role")
          .eq("token", token)
          .maybeSingle();
        
        await supabase.from("active_sessions").delete().eq("token", token);
        
        if (sess) {
          await logEvent("info", "Autenticação", `${sess.username} fez logout`, sess.username, { role: sess.role });
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle login - query app_users table
    const { data: match, error: userError } = await supabase
      .from("app_users")
      .select("username, password, role, display_name, blocked")
      .eq("username", username)
      .eq("password", password)
      .maybeSingle();

    if (userError || !match) {
      await logEvent("warning", "Autenticação", `Tentativa de login falhou para "${username || '(vazio)'}"`, username, { reason: "Credenciais inválidas" });
      return new Response(JSON.stringify({ success: false, error: "Credenciais inválidas" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (match.blocked) {
      await logEvent("warning", "Autenticação", `Usuário bloqueado "${match.username}" tentou fazer login`, match.username, { reason: "Bloqueado" });
      return new Response(JSON.stringify({ success: false, error: "Usuário bloqueado. Contate o administrador." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has an active session (admins bypass this)
    if (match.role !== "admin") {
      const { data: existing } = await supabase
        .from("active_sessions")
        .select("*")
        .eq("username", match.username)
        .maybeSingle();

      if (existing) {
        await logEvent("warning", "Autenticação", `"${match.username}" tentou login mas já está conectado em outro dispositivo`, match.username, { reason: "Sessão duplicada" });
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Usuário "${match.username}" já está conectado em outro dispositivo. Faça logout primeiro.` 
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Admin: remove old sessions before creating new one
      await supabase.from("active_sessions").delete().eq("username", match.username);
    }

    // Create new session
    const newToken = crypto.randomUUID();
    await supabase.from("active_sessions").insert({
      username: match.username,
      token: newToken,
      role: match.role,
    });

    // Log successful login
    await logEvent("info", "Autenticação", `${match.display_name || match.username} fez login (${match.role})`, match.username, { role: match.role });

    // Get user's praças
    const { data: userData } = await supabase
      .from("app_users")
      .select("id")
      .eq("username", match.username)
      .single();

    let userPracas: { id: string; name: string; state: string }[] = [];
    if (userData) {
      const { data: upRows } = await supabase
        .from("user_pracas")
        .select("praca_id")
        .eq("user_id", userData.id);
      
      if (upRows && upRows.length > 0) {
        const pracaIds = upRows.map(r => r.praca_id);
        const { data: pracas } = await supabase
          .from("pracas")
          .select("id, name, state")
          .in("id", pracaIds);
        if (pracas) userPracas = pracas;
      }
    }

    // For admins with no praças assigned, return all praças
    if (match.role === "admin" && userPracas.length === 0) {
      const { data: allPracas } = await supabase
        .from("pracas")
        .select("id, name, state")
        .eq("active", true);
      if (allPracas) userPracas = allPracas;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      token: newToken, 
      username: match.display_name || match.username,
      role: match.role,
      pracas: userPracas,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await logEvent("error", "Autenticação", `Erro interno no login: ${e instanceof Error ? e.message : 'desconhecido'}`);
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
