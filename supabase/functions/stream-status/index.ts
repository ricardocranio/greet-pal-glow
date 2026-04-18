import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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
  { id: "cidadefm",  url: "https://cidadedosolaac.jmvstream.com",       type: "shoutcast" },
  { id: "104fm",     url: "https://radios.braviahost.com.br:8000",      type: "shoutcast" },
  { id: "universitariafm", url: "https://radio.comunica.ufrn.br:8000",  type: "shoutcast" },
  { id: "105fm",     url: "https://stream2.svrdedicado.org:7031",       type: "shoutcast" },
  // Religious
  { id: "nordeste925", url: "https://radio.midiaserverbr.com:9988",     type: "shoutcast" },
  // State
  { id: "marinhafm",   url: "https://stm0.inovativa.net/listen/radiomarinha", type: "icecast" },
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

  const endpoints = [
    { path: '/stats?sid=1&json=1', parser: parseShoutcastJson },
    { path: '/status-json.xsl', parser: parseIcecastJson },
    { path: '/status2.xsl', parser: parseIcecastStatus2 },
    { path: '/7.html', parser: parseShoutcast7html },
  ];

  for (const endpoint of endpoints) {
    const directUrl = `${stream.url}${endpoint.path}`;
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(directUrl)}`;
    const urls = [directUrl, proxyUrl];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), i === 0 ? 6000 : 12000);
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (StreamMonitor/1.0)', 'Accept': '*/*' },
        });
        clearTimeout(timeout);
        if (response.ok) {
          const text = await response.text();
          const parsed = endpoint.parser(text);
          if (parsed) return { ...result, ...parsed, id: stream.id };
        }
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (i === 0 && /certificate|Connect|tls|UnknownIssuer/i.test(msg)) continue;
        break;
      }
    }
  }
  return result;
}

function parseShoutcastJson(text: string): Partial<StreamResult> | null {
  try {
    const data = JSON.parse(text);
    if (data.streams) {
      const s = Array.isArray(data.streams) ? data.streams[0] : Object.values(data.streams)[0] as any;
      if (s) return { online: s.streamstatus === 1, listeners: s.currentlisteners ?? 0, peakListeners: s.peaklisteners ?? 0, title: s.songtitle ?? '', bitrate: s.bitrate ?? 0 };
    }
    if (data.currentlisteners !== undefined) {
      return { online: data.streamstatus === 1, listeners: data.currentlisteners ?? 0, peakListeners: data.peaklisteners ?? 0, title: data.songtitle ?? data.servertitle ?? '', bitrate: data.bitrate ?? 0 };
    }
    return null;
  } catch { return null; }
}

function parseIcecastJson(text: string): Partial<StreamResult> | null {
  try {
    const data = JSON.parse(text);
    const source = data.icestats?.source;
    if (!source) return null;
    const sources = Array.isArray(source) ? source : [source];
    const s = sources.reduce((best: any, cur: any) => 
      (cur.listeners ?? 0) > (best.listeners ?? 0) ? cur : best
    , sources[0]);
    return { online: true, listeners: s.listeners ?? 0, peakListeners: s.listener_peak ?? 0, title: s.title ?? s.server_name ?? '', bitrate: Number(s.bitrate ?? s['ice-bitrate'] ?? 0), };
  } catch { return null; }
}

function parseIcecastStatus2(text: string): Partial<StreamResult> | null {
  try {
    const lines = text.split('\n').filter(l => l.startsWith('/'));
    if (lines.length === 0) return null;
    let best: Partial<StreamResult> | null = null;
    let bestListeners = -1;
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 4) {
        const listeners = parseInt(parts[3]) || 0;
        if (listeners > bestListeners) {
          bestListeners = listeners;
          best = { online: true, listeners, peakListeners: 0, title: (parts[2] || '').trim(), bitrate: 0 };
        }
      }
    }
    return best;
  } catch { return null; }
}

function parseShoutcast7html(text: string): Partial<StreamResult> | null {
  try {
    const match = text.match(/<body[^>]*>(.*?)<\/body>/is);
    if (!match) return null;
    const parts = match[1].split(',');
    if (parts.length >= 7) {
      return { online: parseInt(parts[1]) === 1, listeners: parseInt(parts[0]) || 0, peakListeners: parseInt(parts[2]) || 0, title: parts.slice(6).join(',').trim(), bitrate: parseInt(parts[5]) || 0 };
    }
    return null;
  } catch { return null; }
}

async function saveSnapshots(statuses: StreamResult[]) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = brasiliaTime.getHours();
    const minute = brasiliaTime.getMinutes();

    const rows = statuses
      .filter(s => s.online)
      .map(s => ({
        station_id: s.id,
        listeners: s.listeners,
        peak_listeners: s.peakListeners,
        title: s.title,
        bitrate: s.bitrate,
        hour,
        recorded_at: now.toISOString(),
      }));

    if (rows.length > 0) {
      await supabase.from('audience_snapshots').insert(rows);
    }

    // At 23:55-23:59, trigger daily average calculation for today
    if (hour === 23 && minute >= 55) {
      try {
        const brasiliaStr = brasiliaTime.toISOString().split('T')[0];
        await fetch(`${supabaseUrl}/functions/v1/calculate-daily-averages?date=${brasiliaStr}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('Failed to trigger daily averages:', e);
      }
    }

    // Clean up data older than 90 days — only at minute 0 of each hour to avoid I/O on every poll
    if (minute === 0) {
      const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('audience_snapshots').delete().lt('recorded_at', cutoff);
    }
  } catch (e) {
    console.error('Failed to save snapshots:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const results = await Promise.allSettled(
      STREAMS.map(stream => fetchShoutcastStats(stream))
    );

    const statuses: StreamResult[] = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return { id: STREAMS[i].id, online: false, listeners: 0, peakListeners: 0, title: '', bitrate: 0, error: 'timeout' };
    });

    // Save to database in background (fire-and-forget, doesn't delay response)
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(saveSnapshots(statuses));
    } else {
      saveSnapshots(statuses);
    }

    return new Response(JSON.stringify({ statuses, timestamp: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
