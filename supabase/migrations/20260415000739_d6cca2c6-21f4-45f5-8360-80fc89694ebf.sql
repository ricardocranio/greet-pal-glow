-- Index for fast range queries on recorded_at alone
CREATE INDEX IF NOT EXISTS idx_audience_recorded_at ON public.audience_snapshots USING btree (recorded_at);

-- Composite index for daily_averages date range queries
CREATE INDEX IF NOT EXISTS idx_daily_averages_date ON public.daily_averages USING btree (date);