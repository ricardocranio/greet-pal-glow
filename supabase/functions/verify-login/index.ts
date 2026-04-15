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

  try {
    const { username, password, action, token } = await req.json();

    // Handle logout
    if (action === "logout") {
      if (token) {
        await supabase.from("active_sessions").delete().eq("token", token);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle login
    const validUsers = [
      { username: "ricardo", password: "13501619", role: "admin" },
      { username: "ricardo2", password: "teste", role: "admin" },
      { username: "FelintoF", password: "NatalNatal", role: "viewer" },
      { username: "Wolsey98", password: "Natal98fm", role: "viewer" },
      { username: "FmNordeste", password: "08562027", role: "viewer" },
    ];

    const match = validUsers.find(u => u.username === username && u.password === password);

    if (!match) {
      return new Response(JSON.stringify({ success: false, error: "Credenciais inválidas" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has an active session
    const { data: existing } = await supabase
      .from("active_sessions")
      .select("*")
      .eq("username", match.username)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Usuário "${match.username}" já está conectado em outro dispositivo. Faça logout primeiro.` 
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new session
    const newToken = crypto.randomUUID();
    await supabase.from("active_sessions").insert({
      username: match.username,
      token: newToken,
      role: match.role,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      token: newToken, 
      username: match.username,
      role: match.role,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
