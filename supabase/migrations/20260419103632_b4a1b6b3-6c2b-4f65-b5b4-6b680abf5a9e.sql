
-- 1. Indexes for snapshot queries
CREATE INDEX IF NOT EXISTS idx_snapshots_station_recorded
  ON public.audience_snapshots (station_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_recorded
  ON public.audience_snapshots (recorded_at DESC);

-- 2. Aggregation function: hourly averages for one station over a period
CREATE OR REPLACE FUNCTION public.station_hourly_avg(
  p_station_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_dow_filter text DEFAULT 'all'  -- 'all' | 'weekday' | 'weekend'
)
RETURNS TABLE(hour int, avg_listeners int, samples int)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    s.hour::int,
    ROUND(AVG(s.listeners))::int AS avg_listeners,
    COUNT(*)::int AS samples
  FROM public.audience_snapshots s
  WHERE s.station_id = p_station_id
    AND s.recorded_at >= p_from
    AND s.recorded_at <= p_to
    AND (
      p_dow_filter = 'all'
      OR (p_dow_filter = 'weekday' AND EXTRACT(DOW FROM s.recorded_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 1 AND 5)
      OR (p_dow_filter = 'weekend' AND EXTRACT(DOW FROM s.recorded_at AT TIME ZONE 'America/Sao_Paulo') IN (0, 6))
    )
  GROUP BY s.hour
  ORDER BY s.hour;
$$;

-- 3. Aggregation: averages per day-of-week
CREATE OR REPLACE FUNCTION public.station_dow_avg(
  p_station_id text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(dow int, avg_listeners int, samples int)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW FROM s.recorded_at AT TIME ZONE 'America/Sao_Paulo')::int AS dow,
    ROUND(AVG(s.listeners))::int AS avg_listeners,
    COUNT(*)::int AS samples
  FROM public.audience_snapshots s
  WHERE s.station_id = p_station_id
    AND s.recorded_at >= p_from
    AND s.recorded_at <= p_to
  GROUP BY 1
  ORDER BY 1;
$$;

-- 4. Aggregation: monthly averages
CREATE OR REPLACE FUNCTION public.station_month_avg(
  p_station_id text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(month text, avg_listeners int, samples int)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    TO_CHAR(s.recorded_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS month,
    ROUND(AVG(s.listeners))::int AS avg_listeners,
    COUNT(*)::int AS samples
  FROM public.audience_snapshots s
  WHERE s.station_id = p_station_id
    AND s.recorded_at >= p_from
    AND s.recorded_at <= p_to
  GROUP BY 1
  ORDER BY 1;
$$;

-- 5. Blend: averages per hour for ALL stations on a given day
CREATE OR REPLACE FUNCTION public.blend_hourly_avg(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(station_id text, hour int, avg_listeners int)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    s.station_id,
    s.hour::int,
    ROUND(AVG(s.listeners))::int AS avg_listeners
  FROM public.audience_snapshots s
  WHERE s.recorded_at >= p_from
    AND s.recorded_at <= p_to
  GROUP BY s.station_id, s.hour
  ORDER BY s.station_id, s.hour;
$$;

-- 6. Blend: averages per day-of-week for ALL stations
CREATE OR REPLACE FUNCTION public.blend_dow_avg(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(station_id text, dow int, avg_listeners int)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    s.station_id,
    EXTRACT(DOW FROM s.recorded_at AT TIME ZONE 'America/Sao_Paulo')::int AS dow,
    ROUND(AVG(s.listeners))::int AS avg_listeners
  FROM public.audience_snapshots s
  WHERE s.recorded_at >= p_from
    AND s.recorded_at <= p_to
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

-- 7. Realtime today: returns raw points for one station for today only (small set)
CREATE OR REPLACE FUNCTION public.station_today_realtime(
  p_station_id text
)
RETURNS TABLE(recorded_at timestamptz, listeners int, hour int)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.recorded_at, s.listeners, s.hour::int
  FROM public.audience_snapshots s
  WHERE s.station_id = p_station_id
    AND s.recorded_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
  ORDER BY s.recorded_at;
$$;

-- Allow anon and authenticated to call these read-only aggregates
GRANT EXECUTE ON FUNCTION public.station_hourly_avg(text, timestamptz, timestamptz, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.station_dow_avg(text, timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.station_month_avg(text, timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blend_hourly_avg(timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.blend_dow_avg(timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.station_today_realtime(text) TO anon, authenticated;
