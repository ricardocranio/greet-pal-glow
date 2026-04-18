ALTER TABLE public.audience_snapshots REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audience_snapshots;