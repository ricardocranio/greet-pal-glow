
-- Create monthly_averages table
CREATE TABLE public.monthly_averages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id text NOT NULL,
  month text NOT NULL, -- format: YYYY-MM
  avg_listeners integer NOT NULL DEFAULT 0,
  peak_listeners integer NOT NULL DEFAULT 0,
  peak_hour integer,
  total_days integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (station_id, month)
);

-- Enable RLS
ALTER TABLE public.monthly_averages ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Anyone can read monthly averages"
ON public.monthly_averages
FOR SELECT
USING (true);

-- Only service role can insert (via edge function)
CREATE POLICY "Only service role can insert monthly averages"
ON public.monthly_averages
FOR INSERT
WITH CHECK (false);
