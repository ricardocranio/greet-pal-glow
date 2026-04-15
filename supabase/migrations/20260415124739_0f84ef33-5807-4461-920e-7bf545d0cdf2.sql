CREATE TABLE public.active_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL UNIQUE,
  token text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active sessions"
ON public.active_sessions
FOR SELECT
USING (true);

CREATE POLICY "Only service role can insert sessions"
ON public.active_sessions
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only service role can delete sessions"
ON public.active_sessions
FOR DELETE
USING (false);

CREATE POLICY "Only service role can update sessions"
ON public.active_sessions
FOR UPDATE
USING (false);