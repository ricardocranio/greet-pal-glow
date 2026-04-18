-- Bucket privado para backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('audience-backups', 'audience-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: apenas leitura pública via signed URL; service role grava
CREATE POLICY "Authenticated can list audience backups"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audience-backups');

-- Tabela de log de backups
CREATE TABLE IF NOT EXISTS public.backup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rows_exported INTEGER NOT NULL DEFAULT 0,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read backup_log"
  ON public.backup_log FOR SELECT USING (true);

CREATE POLICY "Only service role can insert backup_log"
  ON public.backup_log FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can delete backup_log"
  ON public.backup_log FOR DELETE USING (false);

CREATE INDEX IF NOT EXISTS idx_backup_log_created ON public.backup_log (created_at DESC);

-- Habilita extensões para cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;