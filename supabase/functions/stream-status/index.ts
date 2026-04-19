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
  { id: "universitariafm", url: "https://radio.comunica.ufrn.br:8000",  type: "icecast" },
  { id: "105fm",     url: "https://stream2.svrdedicado.org:7031",       type: "shoutcast" },
  { id: "nordeste925", url: "https://radio.midiaserverbr.com:9988",     type: "shoutcast" },
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

const ENDPOINTS = [
  { path: '/stats?sid=1&json=1', parser: parseShoutcastJson },
  { path: '/status-json.xsl', parser: parseIcecastJson },
  { path: '/status2.xsl', parser: parseIcecastStatus2 },
  { path: '/7.html', parser: parseShoutcast7html },
];

// In-memory cache: which endpoint worked last for each stream (persists across warm invocations)
const endpointCache = new Map<string, number>();

async function tryFetch(url: string, viaJina: boolean, timeoutMs: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: viaJina
        ? { 'Accept': 'application/json', 'X-Return-Format': 'text' }
        : { 'User-Agent': 'Mozilla/5.0 (StreamMonitor/1.0)', 'Accept': '*/*' },
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    let text = await response.text();
    if (viaJina) {
      try {
        const wrap = JSON.parse(text);
        text = wrap?.data?.text ?? wrap?.data?.content ?? text;
      } catch { /* raw */ }
    }
    return text;
  } catch {
    return null;
  }
}

async function tryEndpoint(stream: StreamConfig, idx: number): Promise<Partial<StreamResult> | null> {
  const ep = ENDPOINTS[idx];
  const directUrl = `${stream.url}${ep.path}`;
  // Try direct first (fast), then jina fallback for TLS issues
  let text = await tryFetch(directUrl, false, 5000);
  if (!text) {
    text = await tryFetch(`https://r.jina.ai/${directUrl}`, true, 8000);
  }
  if (!text) return null;
  return ep.parser(text);
}

async function fetchShoutcastStats(stream: StreamConfig): Promise<StreamResult> {
  const base: StreamResult = {
    id: stream.id, online: false, listeners: 0, peakListeners: 0, title: '', bitrate: 0,
  };

  // 1. Try cached endpoint first (fast path)
  const cachedIdx = endpointCache.get(stream.id);
  if (cachedIdx !== undefined) {
    const result = await tryEndpoint(stream, cachedIdx);
    if (result) return { ...base, ...result };
  }

  // 2. Race all remaining endpoints in parallel — first success wins
  const indices = ENDPOINTS.map((_, i) => i).filter(i => i !== cachedIdx);
  try {
    const winner = await Promise.any(
      indices.map(async (i) => {
        const r = await tryEndpoint(stream, i);
        if (!r) throw new Error('no');
        return { idx: i, result: r };
      })
    );
    endpointCache.set(stream.id, winner.idx);
    return { ...base, ...winner.result };
  } catch {
    return base;
  }
}

function parseShoutcastJson(text: string): Partial<StreamResult> | null {
  try {
    const data = JSON.parse(text);
    if (data.streams) {
      const s = Array.isArray(data.streams) ? data.streams[0] : Object.values(data.streams)[0] as any;
      if (s) {
        const listeners = s.currentlisteners ?? 0;
        // Considera online se streamstatus=1 OU se há ouvintes ativos (caso de servidores que reportam status=0 mas têm listeners)
        return { online: s.streamstatus === 1 || listeners > 0, listeners, peakListeners: s.peaklisteners ?? 0, title: s.songtitle ?? '', bitrate: s.bitrate ?? 0 };
      }
    }
    if (data.currentlisteners !== undefined) {
      const listeners = data.currentlisteners ?? 0;
      return { online: data.streamstatus === 1 || listeners > 0, listeners, peakListeners: data.peaklisteners ?? 0, title: data.songtitle ?? data.servertitle ?? '', bitrate: data.bitrate ?? 0 };
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
    return { online: true, listeners: s.listeners ?? 0, peakListeners: s.listener_peak ?? 0, title: s.title ?? s.server_name ?? '', bitrate: Number(s.bitrate ?? s['ice-bitrate'] ?? 0) };
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
      const listeners = parseInt(parts[0]) || 0;
      const status = parseInt(parts[1]);
      return { online: status === 1 || listeners > 0, listeners, peakListeners: parseInt(parts[2]) || 0, title: parts.slice(6).join(',').trim(), bitrate: parseInt(parts[5]) || 0 };
    }
    return null;
  } catch { return null; }
}

async function persistResults(statuses: StreamResult[]) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = brasiliaTime.getHours();
    const minute = brasiliaTime.getMinutes();

    // 1. Upsert current_status (1 row per station) — drives Realtime updates
    const currentRows = statuses.map(s => ({
      station_id: s.id,
      online: s.online,
      listeners: s.online ? s.listeners : 0,
      peak_listeners: s.peakListeners,
      title: s.title || '',
      bitrate: s.bitrate || 0,
      last_checked: now.toISOString(),
      updated_at: now.toISOString(),
    }));
    await supabase.from('current_status').upsert(currentRows, { onConflict: 'station_id' });

    // 2. Append to audience_snapshots (history) — only online stations
    const snapshotRows = statuses
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
    if (snapshotRows.length > 0) {
      await supabase.from('audience_snapshots').insert(snapshotRows);
    }

    // 3. Trigger daily averages near end of day
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

    // 4. Cleanup old snapshots — only at minute 0
    if (minute === 0) {
      const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('audience_snapshots').delete().lt('recorded_at', cutoff);
    }
  } catch (e) {
    console.error('Failed to persist:', e);
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

    // Background persistence (doesn't delay response)
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(persistResults(statuses));
    } else {
      persistResults(statuses);
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
