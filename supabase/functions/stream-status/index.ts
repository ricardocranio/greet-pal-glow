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

// Load stations from DB at invocation time
async function loadStreams(): Promise<StreamConfig[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase
    .from('stations')
    .select('id, stream_url')
    .eq('active', true)
    .order('display_order', { ascending: true });

  if (error || !data || data.length === 0) {
    console.error('Failed to load stations from DB, using empty list', error);
    return [];
  }

  return data.map((row: { id: string; stream_url: string }) => {
    const url = row.stream_url.replace(/\/stream\/?$/, '').replace(/\/+$/, '');
    // Detect icecast by known patterns
    const type = url.includes('comunica.ufrn.br') || url.includes('inovativa.net')
      ? 'icecast' as const
      : 'shoutcast' as const;
    return { id: row.id, url, type };
  });
}

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
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      minute: 'numeric',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const v: Record<string, string> = {};
    parts.forEach(p => v[p.type] = p.value);
    
    const hour = parseInt(v.hour);
    const minute = parseInt(v.minute);
    const brasiliaDateStr = `${v.year}-${v.month.padStart(2, '0')}-${v.day.padStart(2, '0')}`;

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
        const brasiliaStr = brasiliaDateStr;
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
    const STREAMS = await loadStreams();
    if (STREAMS.length === 0) {
      return new Response(JSON.stringify({ statuses: [], timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.allSettled(
      STREAMS.map(stream => fetchShoutcastStats(stream))
    );

    const statuses: StreamResult[] = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return { id: STREAMS[i].id, online: false, listeners: 0, peakListeners: 0, title: '', bitrate: 0, error: 'timeout' };
    });

    // Background persistence
    await persistResults(statuses);

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
