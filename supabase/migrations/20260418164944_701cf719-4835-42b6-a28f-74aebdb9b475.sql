-- Índices para audience_snapshots (consultas por estação + tempo)
CREATE INDEX IF NOT EXISTS idx_snapshots_station_recorded ON public.audience_snapshots (station_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_recorded ON public.audience_snapshots (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_station_hour ON public.audience_snapshots (station_id, hour);

-- Índices para daily_averages e monthly_averages
CREATE INDEX IF NOT EXISTS idx_daily_station_date ON public.daily_averages (station_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_date ON public.daily_averages (date DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_station_month ON public.monthly_averages (station_id, month DESC);

-- Tabela de status atual (1 linha por estação)
CREATE TABLE IF NOT EXISTS public.current_status (
  station_id TEXT PRIMARY KEY,
  online BOOLEAN NOT NULL DEFAULT false,
  listeners INTEGER NOT NULL DEFAULT 0,
  peak_listeners INTEGER NOT NULL DEFAULT 0,
  title TEXT DEFAULT '',
  bitrate INTEGER DEFAULT 0,
  last_checked TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.current_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read current_status"
  ON public.current_status FOR SELECT USING (true);

CREATE POLICY "Only service role can insert current_status"
  ON public.current_status FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update current_status"
  ON public.current_status FOR UPDATE USING (false);

CREATE POLICY "Only service role can delete current_status"
  ON public.current_status FOR DELETE USING (false);

-- Habilitar Realtime
ALTER TABLE public.current_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.current_status;