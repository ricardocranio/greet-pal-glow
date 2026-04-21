CREATE TABLE public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'info',
  source text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  username text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read system_events" ON public.system_events FOR SELECT USING (true);
CREATE POLICY "Only service role can insert system_events" ON public.system_events FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can delete system_events" ON public.system_events FOR DELETE USING (false);

CREATE INDEX idx_system_events_created_at ON public.system_events(created_at DESC);
CREATE INDEX idx_system_events_type ON public.system_events(event_type);