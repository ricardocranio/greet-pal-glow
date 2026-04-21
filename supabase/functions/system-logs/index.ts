import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  reason?: string;
  fix?: string;
}

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
    const logs: LogEntry[] = [];
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. All stations (active + inactive) for cross-referencing
    const { data: allStations } = await supabase
      .from('stations')
      .select('id, name, active, praca_id, stream_url');

    const stationMap = new Map((allStations ?? []).map((s: any) => [s.id, s]));
    const stationName = (id: string) => stationMap.get(id)?.name || id;
    const stationUrl = (id: string) => stationMap.get(id)?.stream_url || '';

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
      const url = stationUrl(s.station_id);
      const lastCheck = s.last_checked ? new Date(s.last_checked) : null;
      const minutesAgo = lastCheck ? Math.round((now.getTime() - lastCheck.getTime()) / 60000) : null;

      let reason = 'O servidor de streaming não respondeu às tentativas de conexão (direta, jina proxy e allorigins).';
      let fix = 'Verifique se a URL do stream está correta e acessível.';

      if (url.includes('index.html') || url.includes('?sid=')) {
        reason = 'A URL configurada aponta para uma página HTML em vez do servidor de streaming direto.';
        fix = 'Corrija a URL removendo "/index.html" e query strings. Use apenas o endereço base (ex: https://servidor.com).';
      } else if (url.startsWith('https://') && !url.includes('jmvstream') && !url.includes('maxcast') && !url.includes('audiostream')) {
        reason = 'Possível certificado TLS inválido ou auto-assinado impedindo a conexão segura.';
        fix = 'Tente trocar a URL de https:// para http:// se o servidor aceitar conexões não-criptografadas.';
      } else if (!url || !url.trim()) {
        reason = 'Nenhuma URL de streaming foi configurada para esta emissora.';
        fix = 'Acesse Praças & Emissoras e configure a URL do stream.';
      } else if (minutesAgo && minutesAgo > 30) {
        reason = `Servidor sem resposta há ${minutesAgo} minutos. Pode estar fora do ar ou bloqueando conexões de servidores cloud.`;
        fix = 'Confirme que o servidor de streaming está ativo. Se usar firewall, libere o acesso de IPs externos.';
      } else {
        reason = 'O servidor de streaming pode estar temporariamente fora do ar ou com problemas de rede.';
        fix = 'Aguarde alguns minutos e verifique novamente. Se persistir, teste a URL manualmente no navegador.';
      }

      logs.push({
        timestamp: s.last_checked || nowIso,
        level: 'error',
        source: 'Stream Monitor',
        message: `${stationName(s.station_id)} está OFFLINE`,
        reason,
        fix,
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
        const lastCheck = new Date(s.last_checked);
        const minutesAgo = Math.round((now.getTime() - lastCheck.getTime()) / 60000);
        logs.push({
          timestamp: s.last_checked || nowIso,
          level: 'warning',
          source: 'Stream Monitor',
          message: `${stationName(s.station_id)} sem atualização há ${minutesAgo} minutos`,
          reason: 'O cron de monitoramento pode ter falhado ou demorado mais do que o esperado para processar todas as emissoras.',
          fix: 'Verifique se o stream-status está sendo chamado a cada minuto. Se o problema persistir, reduza o timeout das conexões.',
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
        reason: 'A emissora ficou offline durante grande parte do dia, resultando em poucos registros de audiência.',
        fix: 'Verifique o histórico de status da emissora neste dia. Se o stream estava instável, considere trocar a URL.',
      });
    });

    // 6. VALIDATION: stations without current_status
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
          message: `Emissora "${s.name}" (${s.id}) ativa mas sem dados de monitoramento`,
          reason: 'A emissora foi cadastrada recentemente e o ciclo de monitoramento ainda não a processou.',
          fix: 'Aguarde 1-2 minutos para o próximo ciclo do stream-status. Se não aparecer, verifique a URL do stream.',
        });
      }
      if (!s.stream_url || !s.stream_url.trim()) {
        logs.push({
          timestamp: nowIso,
          level: 'warning',
          source: 'Validação',
          message: `Emissora "${s.name}" (${s.id}) sem URL de stream configurada`,
          reason: 'A emissora foi cadastrada sem informar o endereço do streaming.',
          fix: 'Acesse Praças & Emissoras, edite a emissora e adicione a URL do stream (ex: http://servidor:porta).',
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
          reason: 'A praça existe mas nenhuma emissora ativa foi associada a ela.',
          fix: 'Cadastre emissoras nesta praça ou desative-a caso não seja mais necessária.',
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
        reason: 'A emissora está ativa mas não pertence a nenhuma praça, portanto não aparecerá para viewers.',
        fix: 'Acesse Praças & Emissoras e vincule esta emissora a uma praça existente.',
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
