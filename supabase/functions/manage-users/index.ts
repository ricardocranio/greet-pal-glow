import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

    if (!token) return json({ error: "Token obrigatório" }, 401);

    const { data: session } = await supabase
      .from("active_sessions")
      .select("username, role")
      .eq("token", token)
      .maybeSingle();

    if (!session || session.role !== "admin") {
      return json({ error: "Acesso negado" }, 403);
    }

    // ==================== USER ACTIONS ====================

    if (action === "list") {
      const [usersRes, sessionsRes, upRes, pracasRes] = await Promise.all([
        supabase.from("app_users").select("id, username, display_name, role, blocked, created_at").order("created_at", { ascending: true }),
        supabase.from("active_sessions").select("username, created_at"),
        supabase.from("user_pracas").select("user_id, praca_id"),
        supabase.from("pracas").select("id, name, state").order("name"),
      ]);
      return json({ users: usersRes.data, sessions: sessionsRes.data, user_pracas: upRes.data, pracas: pracasRes.data });
    }

    if (action === "add") {
      const { username, password, display_name, role, praca_ids } = body;
      if (!username || !password) return json({ error: "Usuário e senha obrigatórios" }, 400);
      const validRoles = ["admin", "editor", "viewer"];
      const userRole = validRoles.includes(role) ? role : "viewer";
      const { data: newUser, error } = await supabase.from("app_users").insert({
        username, password, display_name: display_name || username, role: userRole,
      }).select("id").single();
      if (error) {
        const msg = error.code === "23505" ? "Usuário já existe" : error.message;
        return json({ error: msg }, 400);
      }
      // Assign praças
      if (newUser && Array.isArray(praca_ids) && praca_ids.length > 0) {
        const rows = praca_ids.map((pid: string) => ({ user_id: newUser.id, praca_id: pid }));
        await supabase.from("user_pracas").insert(rows);
      }
      return json({ success: true });
    }

    if (action === "toggle_block") {
      const { user_id, blocked } = body;
      const { error } = await supabase.from("app_users").update({ blocked }).eq("id", user_id);
      if (error) return json({ error: error.message }, 400);
      if (blocked) {
        const { data: user } = await supabase.from("app_users").select("username").eq("id", user_id).maybeSingle();
        if (user) await supabase.from("active_sessions").delete().eq("username", user.username);
      }
      return json({ success: true });
    }

    if (action === "kick") {
      await supabase.from("active_sessions").delete().eq("username", body.username);
      return json({ success: true });
    }

    if (action === "delete") {
      const { user_id } = body;
      const { data: user } = await supabase.from("app_users").select("username").eq("id", user_id).maybeSingle();
      if (user) await supabase.from("active_sessions").delete().eq("username", user.username);
      await supabase.from("app_users").delete().eq("id", user_id);
      return json({ success: true });
    }

    if (action === "edit") {
      const { user_id, display_name, password: newPass, role: newRole, praca_ids } = body;
      const updates: Record<string, unknown> = {};
      if (display_name !== undefined) updates.display_name = display_name;
      if (newPass) updates.password = newPass;
      if (newRole && ["admin", "editor", "viewer"].includes(newRole)) updates.role = newRole;
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("app_users").update(updates).eq("id", user_id);
        if (error) return json({ error: error.message }, 400);
      }
      // Update praça assignments if provided
      if (Array.isArray(praca_ids)) {
        await supabase.from("user_pracas").delete().eq("user_id", user_id);
        if (praca_ids.length > 0) {
          const rows = praca_ids.map((pid: string) => ({ user_id, praca_id: pid }));
          await supabase.from("user_pracas").insert(rows);
        }
      }
      return json({ success: true });
    }

    // ==================== PRAÇA ACTIONS ====================

    if (action === "list_pracas") {
      const { data, error } = await supabase
        .from("pracas")
        .select("*")
        .order("name", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      return json({ pracas: data });
    }

    if (action === "add_praca") {
      const { name, state } = body;
      if (!name?.trim()) return json({ error: "Nome da praça obrigatório" }, 400);
      const { data, error } = await supabase.from("pracas").insert({
        name: name.trim(),
        state: (state || "").trim(),
      }).select().single();
      if (error) {
        const msg = error.code === "23505" ? "Praça já existe" : error.message;
        return json({ error: msg }, 400);
      }
      return json({ success: true, praca: data });
    }

    if (action === "edit_praca") {
      const { praca_id, name, state, active } = body;
      if (!praca_id) return json({ error: "ID da praça obrigatório" }, 400);
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name.trim();
      if (state !== undefined) updates.state = state.trim();
      if (active !== undefined) updates.active = active;
      const { error } = await supabase.from("pracas").update(updates).eq("id", praca_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "delete_praca") {
      const { praca_id } = body;
      if (!praca_id) return json({ error: "ID da praça obrigatório" }, 400);
      // Unlink stations first
      await supabase.from("stations").update({ praca_id: null }).eq("praca_id", praca_id);
      const { error } = await supabase.from("pracas").delete().eq("id", praca_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // ==================== STATION ACTIONS ====================

    if (action === "list_stations") {
      const { data, error } = await supabase
        .from("stations")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      return json({ stations: data });
    }

    if (action === "add_station") {
      const { id: stationId, name, frequency, stream_url, logo_url, category, display_order, praca_id } = body;
      if (!stationId || !name) return json({ error: "ID e nome são obrigatórios" }, 400);
      const validCategories = ["commercial", "religious", "state"];
      const { error } = await supabase.from("stations").insert({
        id: stationId.trim().toLowerCase().replace(/\s+/g, ''),
        name: name.trim(),
        frequency: (frequency || "").trim(),
        stream_url: (stream_url || "").trim(),
        logo_url: (logo_url || "").trim(),
        category: validCategories.includes(category) ? category : "commercial",
        display_order: display_order || 100,
        active: true,
        praca_id: praca_id || null,
      });
      if (error) {
        const msg = error.code === "23505" ? "Emissora com este ID já existe" : error.message;
        return json({ error: msg }, 400);
      }
      return json({ success: true });
    }

    if (action === "edit_station") {
      const { station_id, name, frequency, stream_url, logo_url, category, display_order, active, praca_id } = body;
      if (!station_id) return json({ error: "ID da emissora obrigatório" }, 400);
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name.trim();
      if (frequency !== undefined) updates.frequency = frequency.trim();
      if (stream_url !== undefined) updates.stream_url = stream_url.trim();
      if (logo_url !== undefined) updates.logo_url = logo_url.trim();
      if (category !== undefined && ["commercial", "religious", "state"].includes(category)) updates.category = category;
      if (display_order !== undefined) updates.display_order = display_order;
      if (active !== undefined) updates.active = active;
      if (praca_id !== undefined) updates.praca_id = praca_id || null;
      const { error } = await supabase.from("stations").update(updates).eq("id", station_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "delete_station") {
      const { station_id } = body;
      if (!station_id) return json({ error: "ID da emissora obrigatório" }, 400);
      const { error } = await supabase.from("stations").delete().eq("id", station_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // ==================== LOGO UPLOAD ====================

    if (action === "upload_logo") {
      const { station_id, file_base64, file_name } = body;
      if (!station_id || !file_base64 || !file_name) {
        return json({ error: "station_id, file_base64 e file_name são obrigatórios" }, 400);
      }

      const ext = file_name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${station_id}.${ext}`;

      // Decode base64
      const binaryString = atob(file_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to storage (upsert)
      const { error: uploadError } = await supabase.storage
        .from("station-logos")
        .upload(path, bytes, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        });

      if (uploadError) return json({ error: uploadError.message }, 400);

      const { data: urlData } = supabase.storage.from("station-logos").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Update station logo_url
      await supabase.from("stations").update({
        logo_url: publicUrl,
        updated_at: new Date().toISOString(),
      }).eq("id", station_id);

      return json({ success: true, logo_url: publicUrl });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    return json({ error: "Erro interno" }, 500);
  }
});
