/*
  # Add blend metrics, indices, and improve data persistence

  1. Changes to daily_averages
    - Add blend_data JSONB column for storing horário/dia/blend averages
    - Add unique constraint for assertive data (station_id, date)
    - Add indices for faster queries

  2. Changes to monthly_averages
    - Add indices for faster aggregations

  3. Changes to audience_snapshots
    - Add indices for time-series queries

  4. Add hourly_peaks improvements
    - Ensure indices for quick lookups

  Security: RLS already enabled on all tables, no changes needed
*/

DO $$
BEGIN
  -- Add blend_data column to daily_averages if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_averages' AND column_name = 'blend_data'
  ) THEN
    ALTER TABLE daily_averages ADD COLUMN blend_data jsonb DEFAULT '{}';
  END IF;

  -- Create unique constraint on (station_id, date) for assertive upserts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'daily_averages' AND constraint_name = 'daily_averages_station_date_unique'
  ) THEN
    ALTER TABLE daily_averages ADD CONSTRAINT daily_averages_station_date_unique UNIQUE (station_id, date);
  END IF;

  -- Add indices for fast queries on daily_averages
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'daily_averages' AND indexname = 'idx_daily_averages_station_date'
  ) THEN
    CREATE INDEX idx_daily_averages_station_date ON daily_averages(station_id, date DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'daily_averages' AND indexname = 'idx_daily_averages_date'
  ) THEN
    CREATE INDEX idx_daily_averages_date ON daily_averages(date DESC);
  END IF;

  -- Add indices for monthly_averages
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'monthly_averages' AND indexname = 'idx_monthly_averages_station_month'
  ) THEN
    CREATE INDEX idx_monthly_averages_station_month ON monthly_averages(station_id, month DESC);
  END IF;

  -- Add indices for audience_snapshots (time-series)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audience_snapshots' AND indexname = 'idx_audience_snapshots_recorded_at'
  ) THEN
    CREATE INDEX idx_audience_snapshots_recorded_at ON audience_snapshots(recorded_at DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audience_snapshots' AND indexname = 'idx_audience_snapshots_station_recorded'
  ) THEN
    CREATE INDEX idx_audience_snapshots_station_recorded ON audience_snapshots(station_id, recorded_at DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audience_snapshots' AND indexname = 'idx_audience_snapshots_hour'
  ) THEN
    CREATE INDEX idx_audience_snapshots_hour ON audience_snapshots(hour);
  END IF;

  -- Add indices for current_status (realtime)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'current_status' AND indexname = 'idx_current_status_listeners'
  ) THEN
    CREATE INDEX idx_current_status_listeners ON current_status(listeners DESC);
  END IF;

  -- Add indices for hourly_peaks
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'hourly_peaks' AND indexname = 'idx_hourly_peaks_station_date'
  ) THEN
    CREATE INDEX idx_hourly_peaks_station_date ON hourly_peaks(station_id, date DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'hourly_peaks' AND indexname = 'idx_hourly_peaks_date_hour'
  ) THEN
    CREATE INDEX idx_hourly_peaks_date_hour ON hourly_peaks(date DESC, hour);
  END IF;
END $$;
