import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface HourlyStats {
  listeners: number[];
  hourMax: Map<number, number>;
  hourlyBySlot: Map<string, number[]>;
}

// Define blend periods (horários combinados)
const BLEND_PERIODS: { [key: string]: number[] } = {
  'manha': [6, 7, 8, 9, 10, 11],           // Manhã (6-11h)
  'tarde': [12, 13, 14, 15, 16, 17, 18],   // Tarde (12-18h)
  'noite': [19, 20, 21, 22, 23, 0, 1, 2],  // Noite (19-2h)
  'madrugada': [3, 4, 5],                  // Madrugada (3-5h)
};

function getBrasiliaDate(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Default: calculate for today (Brasília timezone)
    const now = new Date();
    const brasilia = getBrasiliaDate(now);
    const todayStr = brasilia.toISOString().split('T')[0];

    // Allow custom date via query param
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

    // Group by station with blend calculations
    const byStation = new Map<string, HourlyStats>();
    for (const snap of allData) {
      let entry = byStation.get(snap.station_id);
      if (!entry) {
        entry = { listeners: [], hourMax: new Map(), hourlyBySlot: new Map() };
        byStation.set(snap.station_id, entry);
      }
      entry.listeners.push(snap.listeners);
      const cur = entry.hourMax.get(snap.hour) ?? 0;
      if (snap.listeners > cur) entry.hourMax.set(snap.hour, snap.listeners);

      // Track listeners by blend slot
      for (const [slot, hours] of Object.entries(BLEND_PERIODS)) {
        if (hours.includes(snap.hour)) {
          if (!entry.hourlyBySlot.has(slot)) entry.hourlyBySlot.set(slot, []);
          entry.hourlyBySlot.get(slot)!.push(snap.listeners);
        }
      }
    }

    // Build daily rows with blend data
    const rows = Array.from(byStation.entries()).map(([station_id, entry]) => {
      const avg = Math.round(entry.listeners.reduce((a, b) => a + b, 0) / entry.listeners.length);
      const peak = Math.max(...entry.listeners);
      let peakHour = 0;
      let peakVal = 0;
      for (const [h, v] of entry.hourMax) {
        if (v > peakVal) { peakVal = v; peakHour = h; }
      }

      // Calculate blend averages
      const blendData: { [key: string]: number } = {};
      for (const [slot, values] of entry.hourlyBySlot) {
        blendData[slot] = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      }

      return {
        station_id,
        date: targetDate,
        avg_listeners: avg,
        peak_listeners: peak,
        peak_hour: peakHour,
        total_snapshots: entry.listeners.length,
        min_listeners: Math.min(...entry.listeners),
        blend_data: blendData,
      };
    });

    // Upsert daily averages
    if (rows.length > 0) {
      // Split blend_data to avoid JSONB issues with upsert
      const rowsToInsert = rows.map(r => {
        const { blend_data, ...rest } = r;
        return rest;
      });
      const { error } = await supabase
        .from('daily_averages')
        .upsert(rowsToInsert, { onConflict: 'station_id,date' });
      if (error) throw error;

      // Log successful calculation
      await supabase.from('system_events').insert({
        event_type: 'info',
        source: 'daily-averages',
        message: `Médias diárias calculadas para ${targetDate}: ${rows.length} estações`,
        metadata: { date: targetDate, stations: rows.length, snapshots: allData.length },
      });
    }

    // ===== MONTHLY AVERAGES =====
    const targetMonth = targetDate.substring(0, 7);
    const monthStart = `${targetMonth}-01`;
    const monthEndDate = new Date(parseInt(targetMonth.split('-')[0]), parseInt(targetMonth.split('-')[1]), 0);
    const monthEnd = `${targetMonth}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

    const monthlyData: any[] = [];
    let mFrom = 0;
    while (true) {
      const { data } = await supabase
        .from('daily_averages')
        .select('station_id, avg_listeners, peak_listeners, peak_hour')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .range(mFrom, mFrom + pageSize - 1);
      if (!data || data.length === 0) break;
      monthlyData.push(...data);
      if (data.length < pageSize) break;
      mFrom += pageSize;
    }

    // Aggregate monthly by station
    const monthByStation = new Map<string, { sum: number; count: number; peak: number; peakHour: number; peakVal: number }>();
    for (const row of monthlyData) {
      let entry = monthByStation.get(row.station_id);
      if (!entry) entry = { sum: 0, count: 0, peak: 0, peakHour: 0, peakVal: 0 };
      entry.sum += row.avg_listeners;
      entry.count += 1;
      if (row.peak_listeners > entry.peak) {
        entry.peak = row.peak_listeners;
        entry.peakHour = row.peak_hour ?? 0;
      }
      monthByStation.set(row.station_id, entry);
    }

    const monthlyRows = Array.from(monthByStation.entries()).map(([station_id, entry]) => ({
      station_id,
      month: targetMonth,
      avg_listeners: Math.round(entry.sum / entry.count),
      peak_listeners: entry.peak,
      peak_hour: entry.peakHour,
      total_days: entry.count,
    }));

    if (monthlyRows.length > 0) {
      await supabase
        .from('monthly_averages')
        .upsert(monthlyRows, { onConflict: 'station_id,month' });
    }

    return new Response(
      JSON.stringify({
        date: targetDate,
        stations: rows.length,
        snapshots: allData.length,
        monthly_stations: monthlyRows.length,
        month: targetMonth,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Daily averages error:', msg);

    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
