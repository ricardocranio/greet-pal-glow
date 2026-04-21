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

    // Verify admin session
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token obrigatório' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: session } = await supabase
      .from('active_sessions')
      .select('role')
      .eq('token', token)
      .single();

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Collect errors from multiple sources

    // 1. Check for recent edge function errors by looking at current_status for offline stations
    const { data: offlineStations } = await supabase
      .from('current_status')
      .select('station_id, online, listeners, last_checked, title')
      .eq('online', false);

    // 2. Check for stations with no recent data (possibly broken streams)
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    const { data: staleStations } = await supabase
      .from('current_status')
      .select('station_id, last_checked, online')
      .lt('last_checked', cutoff);

    // 3. Check for failed daily averages (days with very few snapshots)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: lowSnapshots } = await supabase
      .from('daily_averages')
      .select('station_id, date, total_snapshots, avg_listeners')
      .gte('date', threeDaysAgo)
      .lt('total_snapshots', 50)
      .order('date', { ascending: false })
      .limit(50);

    // 4. Get station names for display
    const { data: stations } = await supabase
      .from('stations')
      .select('id, name')
      .eq('active', true);

    const stationMap = new Map((stations ?? []).map((s: any) => [s.id, s.name]));

    const logs: { timestamp: string; level: string; source: string; message: string }[] = [];
    const now = new Date().toISOString();

    // Offline stations
    (offlineStations ?? []).forEach((s: any) => {
      const name = stationMap.get(s.station_id) || s.station_id;
      logs.push({
        timestamp: s.last_checked || now,
        level: 'error',
        source: 'Stream Monitor',
        message: `${name} está OFFLINE desde ${new Date(s.last_checked).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      });
    });

    // Stale stations (no updates in 10+ min)
    (staleStations ?? []).forEach((s: any) => {
      const name = stationMap.get(s.station_id) || s.station_id;
      const alreadyOffline = (offlineStations ?? []).some((o: any) => o.station_id === s.station_id);
      if (!alreadyOffline) {
        logs.push({
          timestamp: s.last_checked || now,
          level: 'warning',
          source: 'Stream Monitor',
          message: `${name} sem atualização há mais de 10 minutos (último check: ${new Date(s.last_checked).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`,
        });
      }
    });

    // Low snapshot days
    (lowSnapshots ?? []).forEach((s: any) => {
      const name = stationMap.get(s.station_id) || s.station_id;
      logs.push({
        timestamp: `${s.date}T23:59:59Z`,
        level: 'warning',
        source: 'Daily Averages',
        message: `${name} em ${s.date}: apenas ${s.total_snapshots} snapshots (média: ${s.avg_listeners} ouvintes)`,
      });
    });

    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return new Response(JSON.stringify({ logs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
