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

    // Handle login - query app_users table
    const { data: match, error: userError } = await supabase
      .from("app_users")
      .select("username, password, role, display_name, blocked")
      .eq("username", username)
      .eq("password", password)
      .maybeSingle();

    if (userError || !match) {
      return new Response(JSON.stringify({ success: false, error: "Credenciais inválidas" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (match.blocked) {
      return new Response(JSON.stringify({ success: false, error: "Usuário bloqueado. Contate o administrador." }), {
        status: 403,
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
      username: match.display_name || match.username,
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
