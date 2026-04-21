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
    let token: string | null = null;
    try {
      const body = await req.json();
      token = body.token;
    } catch {
      return new Response(JSON.stringify({ error: 'Body inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token obrigatório' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: session, error: sessionError } = await supabase
      .from('active_sessions')
      .select('role, username')
      .eq('token', token)
      .maybeSingle();

    if (sessionError) {
      console.error('Session lookup error:', sessionError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar sessão' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!session || session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Acesso negado', debug: { hasSession: !!session, role: session?.role } }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== Collect system diagnostics =====
    const logs: { timestamp: string; level: string; source: string; message: string }[] = [];
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. All stations (active + inactive) for cross-referencing
    const { data: allStations } = await supabase
      .from('stations')
      .select('id, name, active, praca_id, stream_url');

    const stationMap = new Map((allStations ?? []).map((s: any) => [s.id, s]));
    const stationName = (id: string) => stationMap.get(id)?.name || id;

    // 2. All praças
    const { data: allPracas } = await supabase
      .from('pracas')
      .select('id, name, state, active, created_at');

    // 3. Offline stations
    const { data: offlineStations } = await supabase
      .from('current_status')
      .select('station_id, online, listeners, last_checked')
      .eq('online', false);

    (offlineStations ?? []).forEach((s: any) => {
      logs.push({
        timestamp: s.last_checked || nowIso,
        level: 'error',
        source: 'Stream Monitor',
        message: `${stationName(s.station_id)} está OFFLINE`,
      });
    });

    // 4. Stale stations (no update in 10+ min)
    const cutoff10m = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const { data: staleStations } = await supabase
      .from('current_status')
      .select('station_id, last_checked, online')
      .lt('last_checked', cutoff10m);

    (staleStations ?? []).forEach((s: any) => {
      const alreadyOffline = (offlineStations ?? []).some((o: any) => o.station_id === s.station_id);
      if (!alreadyOffline) {
        logs.push({
          timestamp: s.last_checked || nowIso,
          level: 'warning',
          source: 'Stream Monitor',
          message: `${stationName(s.station_id)} sem atualização há mais de 10 minutos`,
        });
      }
    });

    // 5. Low snapshot days (last 3 days)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: lowSnapshots } = await supabase
      .from('daily_averages')
      .select('station_id, date, total_snapshots, avg_listeners')
      .gte('date', threeDaysAgo)
      .lt('total_snapshots', 50)
      .order('date', { ascending: false })
      .limit(50);

    (lowSnapshots ?? []).forEach((s: any) => {
      logs.push({
        timestamp: `${s.date}T23:59:59Z`,
        level: 'warning',
        source: 'Daily Averages',
        message: `${stationName(s.station_id)} em ${s.date}: apenas ${s.total_snapshots} snapshots`,
      });
    });

    // ===== 6. VALIDATION: stations without current_status (new stations not yet monitored) =====
    const { data: currentStatuses } = await supabase
      .from('current_status')
      .select('station_id');

    const monitoredIds = new Set((currentStatuses ?? []).map((c: any) => c.station_id));

    (allStations ?? []).filter((s: any) => s.active).forEach((s: any) => {
      if (!monitoredIds.has(s.id)) {
        logs.push({
          timestamp: nowIso,
          level: 'warning',
          source: 'Validação',
          message: `Emissora "${s.name}" (${s.id}) ativa mas ainda sem dados de monitoramento`,
        });
      }
      if (!s.stream_url || !s.stream_url.trim()) {
        logs.push({
          timestamp: nowIso,
          level: 'warning',
          source: 'Validação',
          message: `Emissora "${s.name}" (${s.id}) sem URL de stream configurada`,
        });
      }
    });

    // 7. VALIDATION: praças without stations
    (allPracas ?? []).filter((p: any) => p.active).forEach((p: any) => {
      const hasStations = (allStations ?? []).some((s: any) => s.praca_id === p.id && s.active);
      if (!hasStations) {
        logs.push({
          timestamp: p.created_at || nowIso,
          level: 'info',
          source: 'Validação',
          message: `Praça "${p.name}/${(p.state || '').toUpperCase()}" não tem emissoras ativas vinculadas`,
        });
      }
    });

    // 8. VALIDATION: stations without praça
    (allStations ?? []).filter((s: any) => s.active && !s.praca_id).forEach((s: any) => {
      logs.push({
        timestamp: nowIso,
        level: 'warning',
        source: 'Validação',
        message: `Emissora "${s.name}" (${s.id}) não está vinculada a nenhuma praça`,
      });
    });

    // Sort by timestamp desc
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return new Response(JSON.stringify({ logs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('system-logs error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
