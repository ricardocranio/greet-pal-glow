
CREATE TABLE public.user_pracas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  praca_id UUID NOT NULL REFERENCES public.pracas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, praca_id)
);

ALTER TABLE public.user_pracas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user_pracas" ON public.user_pracas FOR SELECT USING (true);
CREATE POLICY "Only service role can insert user_pracas" ON public.user_pracas FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update user_pracas" ON public.user_pracas FOR UPDATE USING (false);
CREATE POLICY "Only service role can delete user_pracas" ON public.user_pracas FOR DELETE USING (false);
