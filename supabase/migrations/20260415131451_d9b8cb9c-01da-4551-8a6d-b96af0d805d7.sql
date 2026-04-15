
CREATE TABLE public.app_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_users" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "Only service role can insert app_users" ON public.app_users FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update app_users" ON public.app_users FOR UPDATE USING (false);
CREATE POLICY "Only service role can delete app_users" ON public.app_users FOR DELETE USING (false);

INSERT INTO public.app_users (username, password, display_name, role, blocked) VALUES
  ('ricardo', '13501619', 'Ricardo Amaral', 'admin', false),
  ('ricardo2', 'teste', 'Ricardo (Teste)', 'admin', false),
  ('FelintoF', 'NatalNatal', 'Felinto F.', 'viewer', false),
  ('Wolsey98', 'Natal98fm', 'Wolsey 98FM', 'viewer', false),
  ('FmNordeste', '08562027', 'FM Nordeste', 'viewer', false);
