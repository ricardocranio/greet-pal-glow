const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_HOSTS = [
  "cast42.sitehosting.com.br",
  "centova10.ciclanohost.com.br",
  "radios.braviahost.com.br",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const streamUrl = url.searchParams.get("url");

  if (!streamUrl) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate the stream URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(streamUrl);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid url" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Only allow whitelisted hosts
  if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
    return new Response(JSON.stringify({ error: "Host not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Only proxy http URLs
  if (parsedUrl.protocol !== "http:") {
    return new Response(JSON.stringify({ error: "Only http streams need proxying" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const upstream = await fetch(streamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RadioMonitor/1.0)",
        "Icy-MetaData": "0",
      },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: "Upstream failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Proxy error" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
