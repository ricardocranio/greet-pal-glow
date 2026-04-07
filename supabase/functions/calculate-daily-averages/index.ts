import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Default: calculate for today (Brasília timezone UTC-3)
    const now = new Date();
    const brasilia = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const todayStr = brasilia.toISOString().split('T')[0];

    // Allow a custom date via query param
    const url = new URL(req.url);
    const targetDate = url.searchParams.get('date') || todayStr;

    // Fetch all snapshots for the target date
    const startOfDay = `${targetDate}T00:00:00-03:00`;
    const endOfDay = `${targetDate}T23:59:59-03:00`;

    const allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data } = await supabase
        .from('audience_snapshots')
        .select('station_id, listeners, hour')
        .gte('recorded_at', startOfDay)
        .lte('recorded_at', endOfDay)
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Group by station
    const byStation = new Map<string, { listeners: number[]; hourMax: Map<number, number> }>();
    for (const snap of allData) {
      let entry = byStation.get(snap.station_id);
      if (!entry) {
        entry = { listeners: [], hourMax: new Map() };
        byStation.set(snap.station_id, entry);
      }
      entry.listeners.push(snap.listeners);
      const cur = entry.hourMax.get(snap.hour) ?? 0;
      if (snap.listeners > cur) entry.hourMax.set(snap.hour, snap.listeners);
    }

    // Build rows
    const rows = Array.from(byStation.entries()).map(([station_id, entry]) => {
      const avg = Math.round(entry.listeners.reduce((a, b) => a + b, 0) / entry.listeners.length);
      const peak = Math.max(...entry.listeners);
      let peakHour = 0;
      let peakVal = 0;
      for (const [h, v] of entry.hourMax) {
        if (v > peakVal) { peakVal = v; peakHour = h; }
      }
      return {
        station_id,
        date: targetDate,
        avg_listeners: avg,
        peak_listeners: peak,
        peak_hour: peakHour,
        total_snapshots: entry.listeners.length,
      };
    });

    if (rows.length > 0) {
      const { error } = await supabase
        .from('daily_averages')
        .upsert(rows, { onConflict: 'station_id,date' });
      if (error) throw error;
    }

    return new Response(JSON.stringify({ date: targetDate, stations: rows.length, snapshots: allData.length }), {
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
