const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface StreamConfig {
  id: string;
  url: string;
  type: 'shoutcast' | 'icecast' | 'shoutcast-html';
}

const STREAMS: StreamConfig[] = [
  { id: "98fm",      url: "http://cast42.sitehosting.com.br:8010",      type: "shoutcast" },
  { id: "97fm",      url: "https://azevedo.jmvstream.com",              type: "shoutcast" },
  { id: "96fm",      url: "http://centova10.ciclanohost.com.br:6258",    type: "shoutcast" },
  { id: "95fm",      url: "https://radio.saopaulo01.com.br:10841",      type: "shoutcast" },
  { id: "91fm",      url: "https://live9.livemus.com.br:27802",         type: "shoutcast" },
  { id: "clubefm",   url: "http://radios.braviahost.com.br:8012",       type: "shoutcast" },
  { id: "mundialfm", url: "https://stm4.srvstm.com:7252",              type: "shoutcast" },
  { id: "jpnatal",   url: "https://pannatal.jmvstream.com",             type: "shoutcast" },
  { id: "jpnews",    url: "https://s02.maxcast.com.br:8082",            type: "shoutcast" },
  { id: "104fm",     url: "https://radios.braviahost.com.br:8000",      type: "shoutcast" },
];

interface StreamResult {
  id: string;
  online: boolean;
  listeners: number;
  peakListeners: number;
  title: string;
  bitrate: number;
  error?: string;
}

async function fetchShoutcastStats(stream: StreamConfig): Promise<StreamResult> {
  const result: StreamResult = {
    id: stream.id,
    online: false,
    listeners: 0,
    peakListeners: 0,
    title: '',
    bitrate: 0,
  };

  // Try multiple Shoutcast/Icecast endpoints
  const endpoints = [
    { path: '/stats?sid=1&json=1', parser: parseShoutcastJson },
    { path: '/status-json.xsl', parser: parseIcecastJson },
    { path: '/7.html', parser: parseShoutcast7html },
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${stream.url}${endpoint.path}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (StreamMonitor/1.0)',
          'Accept': '*/*',
        },
      });
      clearTimeout(timeout);

      if (response.ok) {
        const text = await response.text();
        const parsed = endpoint.parser(text);
        if (parsed) {
          return { ...result, ...parsed, id: stream.id };
        }
      }
    } catch (_e) {
      // Try next endpoint
    }
  }

  return result;
}

function parseShoutcastJson(text: string): Partial<StreamResult> | null {
  try {
    const data = JSON.parse(text);
    // Shoutcast v2 format
    if (data.streams) {
      const s = Array.isArray(data.streams) ? data.streams[0] : Object.values(data.streams)[0] as Record<string, unknown>;
      if (s) {
        return {
          online: (s as any).streamstatus === 1,
          listeners: (s as any).currentlisteners ?? 0,
          peakListeners: (s as any).peaklisteners ?? 0,
          title: (s as any).songtitle ?? '',
          bitrate: (s as any).bitrate ?? 0,
        };
      }
    }
    // Shoutcast v1 JSON format
    if (data.currentlisteners !== undefined) {
      return {
        online: data.streamstatus === 1,
        listeners: data.currentlisteners ?? 0,
        peakListeners: data.peaklisteners ?? 0,
        title: data.songtitle ?? data.servertitle ?? '',
        bitrate: data.bitrate ?? 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function parseIcecastJson(text: string): Partial<StreamResult> | null {
  try {
    const data = JSON.parse(text);
    const source = data.icestats?.source;
    if (!source) return null;
    const s = Array.isArray(source) ? source[0] : source;
    return {
      online: true,
      listeners: s.listeners ?? 0,
      peakListeners: s.listener_peak ?? 0,
      title: s.title ?? s.server_name ?? '',
      bitrate: s.bitrate ?? 0,
    };
  } catch {
    return null;
  }
}

function parseShoutcast7html(text: string): Partial<StreamResult> | null {
  try {
    // Format: <body>CUR,STATUS,PEAK,MAX,UNIQUE,BITRATE,SONGTITLE</body>
    const match = text.match(/<body[^>]*>(.*?)<\/body>/is);
    if (!match) return null;
    const parts = match[1].split(',');
    if (parts.length >= 7) {
      return {
        online: parseInt(parts[1]) === 1,
        listeners: parseInt(parts[0]) || 0,
        peakListeners: parseInt(parts[2]) || 0,
        title: parts.slice(6).join(',').trim(),
        bitrate: parseInt(parts[5]) || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Fetch all streams in parallel with individual timeouts
    const results = await Promise.allSettled(
      STREAMS.map(stream => fetchShoutcastStats(stream))
    );

    const statuses: StreamResult[] = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        id: STREAMS[i].id,
        online: false,
        listeners: 0,
        peakListeners: 0,
        title: '',
        bitrate: 0,
        error: 'timeout',
      };
    });

    return new Response(JSON.stringify({ 
      statuses, 
      timestamp: new Date().toISOString() 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
