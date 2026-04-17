import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "rows required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    // Insert in pages of 1000 to stay safe
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 1000) {
      const slice = rows.slice(i, i + 1000);
      const { error, count } = await supabase
        .from("audience_snapshots")
        .upsert(slice, { onConflict: "id", ignoreDuplicates: true, count: "exact" });
      if (error) {
        return new Response(JSON.stringify({ error: error.message, inserted }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      inserted += count ?? slice.length;
    }
    return new Response(JSON.stringify({ ok: true, inserted }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
