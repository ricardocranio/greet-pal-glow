import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => csvEscape(r[h])).join(','));
  }
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Janela: últimos 7 dias (Brasília)
    const now = new Date();
    const end = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    const periodStart = start.toISOString().split('T')[0];
    const periodEnd = end.toISOString().split('T')[0];

    // Buscar snapshots do período (paginado para ultrapassar limite de 1000)
    const allRows: Record<string, unknown>[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('audience_snapshots')
        .select('station_id, recorded_at, hour, listeners, peak_listeners, title, bitrate')
        .gte('recorded_at', startISO)
        .lte('recorded_at', endISO)
        .order('recorded_at', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Buscar daily_averages do período
    const { data: dailyData } = await supabase
      .from('daily_averages')
      .select('station_id, date, avg_listeners, peak_listeners, peak_hour, total_snapshots')
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('date', { ascending: true });

    // Montar CSV combinado: bloco de snapshots + bloco de médias diárias
    const snapshotsCsv = toCsv(allRows);
    const dailyCsv = toCsv(dailyData ?? []);

    const csv =
      `# Backup de Audiência\n` +
      `# Período: ${periodStart} a ${periodEnd}\n` +
      `# Gerado em: ${now.toISOString()}\n` +
      `# Snapshots: ${allRows.length} | Médias diárias: ${dailyData?.length ?? 0}\n` +
      `\n## SNAPSHOTS DETALHADOS\n` +
      snapshotsCsv +
      `\n\n## MÉDIAS DIÁRIAS\n` +
      dailyCsv +
      `\n`;

    const fileName = `backup-${periodStart}-to-${periodEnd}-${Date.now()}.csv`;
    const bytes = new TextEncoder().encode(csv);

    // Upload no bucket
    const { error: upErr } = await supabase.storage
      .from('audience-backups')
      .upload(fileName, bytes, {
        contentType: 'text/csv; charset=utf-8',
        upsert: false,
      });
    if (upErr) throw upErr;

    // Registrar log
    await supabase.from('backup_log').insert({
      file_name: fileName,
      period_start: periodStart,
      period_end: periodEnd,
      rows_exported: allRows.length,
      file_size_bytes: bytes.byteLength,
    });

    // Limpar backups com mais de 90 dias
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldLogs } = await supabase
      .from('backup_log')
      .select('file_name')
      .lt('created_at', cutoff);
    if (oldLogs && oldLogs.length > 0) {
      await supabase.storage.from('audience-backups').remove(oldLogs.map(l => l.file_name));
      await supabase.from('backup_log').delete().lt('created_at', cutoff);
    }

    return new Response(JSON.stringify({
      success: true,
      file_name: fileName,
      rows_exported: allRows.length,
      file_size_bytes: bytes.byteLength,
      period: { start: periodStart, end: periodEnd },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('Backup failed:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
