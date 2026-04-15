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
    const body = await req.json();
    const { action, token } = body;

    // Verify admin token
    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session } = await supabase
      .from("active_sessions")
      .select("username, role")
      .eq("token", token)
      .maybeSingle();

    if (!session || session.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LIST users
    if (action === "list") {
      const { data: users } = await supabase
        .from("app_users")
        .select("id, username, display_name, role, blocked, created_at")
        .order("created_at", { ascending: true });

      const { data: sessions } = await supabase
        .from("active_sessions")
        .select("username, created_at");

      return new Response(JSON.stringify({ users, sessions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADD user
    if (action === "add") {
      const { username, password, display_name, role } = body;
      if (!username || !password) {
        return new Response(JSON.stringify({ error: "Usuário e senha obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const validRoles = ["admin", "editor", "viewer"];
      const userRole = validRoles.includes(role) ? role : "viewer";

      const { error } = await supabase.from("app_users").insert({
        username, password, display_name: display_name || username, role: userRole,
      });

      if (error) {
        const msg = error.code === "23505" ? "Usuário já existe" : error.message;
        return new Response(JSON.stringify({ error: msg }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TOGGLE BLOCK
    if (action === "toggle_block") {
      const { user_id, blocked } = body;
      const { error } = await supabase
        .from("app_users")
        .update({ blocked })
        .eq("id", user_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If blocking, also remove their active session
      if (blocked) {
        const { data: user } = await supabase
          .from("app_users")
          .select("username")
          .eq("id", user_id)
          .maybeSingle();
        if (user) {
          await supabase.from("active_sessions").delete().eq("username", user.username);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // KICK (force logout)
    if (action === "kick") {
      const { username } = body;
      await supabase.from("active_sessions").delete().eq("username", username);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE user
    if (action === "delete") {
      const { user_id } = body;
      const { data: user } = await supabase
        .from("app_users")
        .select("username")
        .eq("id", user_id)
        .maybeSingle();
      
      if (user) {
        await supabase.from("active_sessions").delete().eq("username", user.username);
      }
      
      await supabase.from("app_users").delete().eq("id", user_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // EDIT user
    if (action === "edit") {
      const { user_id, display_name, password: newPass, role: newRole } = body;
      const updates: Record<string, unknown> = {};
      if (display_name !== undefined) updates.display_name = display_name;
      if (newPass) updates.password = newPass;
      if (newRole && ["admin", "editor", "viewer"].includes(newRole)) updates.role = newRole;

      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: "Nenhuma alteração informada" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("app_users").update(updates).eq("id", user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
