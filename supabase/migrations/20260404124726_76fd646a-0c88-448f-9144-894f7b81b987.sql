
CREATE TABLE public.audience_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id TEXT NOT NULL,
  listeners INTEGER NOT NULL DEFAULT 0,
  peak_listeners INTEGER NOT NULL DEFAULT 0,
  title TEXT DEFAULT '',
  bitrate INTEGER DEFAULT 0,
  hour INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audience_station_date ON public.audience_snapshots (station_id, recorded_at);
CREATE INDEX idx_audience_hour ON public.audience_snapshots (hour, recorded_at);

ALTER TABLE public.audience_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audience snapshots"
ON public.audience_snapshots
FOR SELECT
USING (true);

CREATE POLICY "Only service role can insert snapshots"
ON public.audience_snapshots
FOR INSERT
WITH CHECK (false);
