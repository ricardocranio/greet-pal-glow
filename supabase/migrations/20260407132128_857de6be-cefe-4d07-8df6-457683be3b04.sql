
-- Table to store daily audience averages per station for monthly reports
CREATE TABLE public.daily_averages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id TEXT NOT NULL,
  date DATE NOT NULL,
  avg_listeners INTEGER NOT NULL DEFAULT 0,
  peak_listeners INTEGER NOT NULL DEFAULT 0,
  peak_hour INTEGER,
  total_snapshots INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one row per station per day
ALTER TABLE public.daily_averages ADD CONSTRAINT unique_station_date UNIQUE (station_id, date);

-- Enable RLS
ALTER TABLE public.daily_averages ENABLE ROW LEVEL SECURITY;

-- Public read access for reports
CREATE POLICY "Anyone can read daily averages"
ON public.daily_averages FOR SELECT TO public USING (true);

-- Block public inserts (only service role via edge function)
CREATE POLICY "Only service role can insert daily averages"
ON public.daily_averages FOR INSERT TO public WITH CHECK (false);

-- Index for monthly report queries
CREATE INDEX idx_daily_averages_station_date ON public.daily_averages (station_id, date);
