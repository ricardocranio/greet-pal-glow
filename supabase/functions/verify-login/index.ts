import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    const validUsers = [
      { username: "ricardo", password: "13501619" },
      { username: "ricardo2", password: "teste" },
      { username: "FelintoF", password: "NatalNatal" },
      { username: "Wolsey98", password: "Natal98fm" },
    ];

    const match = validUsers.find(u => u.username === username && u.password === password);

    if (match) {
      const token = crypto.randomUUID();
      return new Response(JSON.stringify({ success: true, token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Credenciais inválidas" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
