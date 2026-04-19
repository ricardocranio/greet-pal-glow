
CREATE OR REPLACE FUNCTION public.station_peak_min(
  p_station_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_dow_filter text DEFAULT 'all'  -- 'all' | 'weekday' | 'weekend' | 'date'
)
RETURNS TABLE(
  peak_listeners int,
  peak_at timestamptz,
  min_listeners int,
  min_at timestamptz,
  samples int
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT s.listeners, s.recorded_at
    FROM public.audience_snapshots s
    WHERE s.station_id = p_station_id
      AND s.recorded_at >= p_from
      AND s.recorded_at <= p_to
      AND (
        p_dow_filter IN ('all', 'date')
        OR (p_dow_filter = 'weekday' AND EXTRACT(DOW FROM s.recorded_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 1 AND 5)
        OR (p_dow_filter = 'weekend' AND EXTRACT(DOW FROM s.recorded_at AT TIME ZONE 'America/Sao_Paulo') IN (0, 6))
      )
  ),
  pk AS (SELECT listeners, recorded_at FROM filtered ORDER BY listeners DESC, recorded_at ASC LIMIT 1),
  mn AS (SELECT listeners, recorded_at FROM filtered ORDER BY listeners ASC, recorded_at ASC LIMIT 1)
  SELECT
    COALESCE((SELECT listeners FROM pk), 0)::int,
    (SELECT recorded_at FROM pk),
    COALESCE((SELECT listeners FROM mn), 0)::int,
    (SELECT recorded_at FROM mn),
    (SELECT COUNT(*) FROM filtered)::int;
$$;

GRANT EXECUTE ON FUNCTION public.station_peak_min(text, timestamptz, timestamptz, text) TO anon, authenticated;
