
-- Create stations table to replace hardcoded data
CREATE TABLE public.stations (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT '',
  stream_url TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'commercial',
  display_order INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

-- Everyone can read stations
CREATE POLICY "Anyone can read stations"
  ON public.stations FOR SELECT
  USING (true);

-- Only service role can modify
CREATE POLICY "Only service role can insert stations"
  ON public.stations FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Only service role can update stations"
  ON public.stations FOR UPDATE
  USING (false);

CREATE POLICY "Only service role can delete stations"
  ON public.stations FOR DELETE
  USING (false);

-- Seed with existing hardcoded stations
INSERT INTO public.stations (id, name, frequency, stream_url, logo_url, category, display_order) VALUES
  ('98fm', '98 FM NATAL', '98,9 MHz', 'http://cast42.sitehosting.com.br:8010', 'https://98fmnatal.com.br/site-core/views/18359912b2/inc/site/assets/images/new-logo2.png', 'commercial', 1),
  ('97fm', '97 FM NATAL', '97,9 MHz', 'https://azevedo.jmvstream.com/stream', 'https://97fmnatal.com.br/images/logo.png', 'commercial', 2),
  ('96fm', '96 FM NATAL', '96,7 MHz', 'http://centova10.ciclanohost.com.br:6258/stream', 'https://96fm.com.br/build/assets/logo-fba33526.png', 'commercial', 3),
  ('95fm', '95 FM NATAL', '95,9 MHz', 'https://radio.saopaulo01.com.br:10841/stream', 'https://www.95maisfm.com.br/wp-content/uploads/2020/06/logo-1.png', 'commercial', 4),
  ('91fm', 'RURAL DE NATAL FM', '91,9 MHz', 'https://live9.livemus.com.br:27802/stream', 'https://static.wixstatic.com/media/a8ed9c_7c3021d0f64f46d3a50f3f7f4bc8835d~mv2.png', 'commercial', 5),
  ('clubefm', 'CLUBE FM NATAL', '106,3 MHz', 'http://radios.braviahost.com.br:8012/stream', 'https://painel.clube.fm/wp-content/uploads/2025/02/Logo-Clube-106-3.png', 'commercial', 6),
  ('mundialfm', 'MUNDIAL FM NATAL', '91,1 MHz', 'https://stm4.srvstm.com:7252/stream', '/logos/mundial-fm.jpeg', 'commercial', 7),
  ('jpnatal', 'JP FM NATAL', '99,5 MHz', 'https://pannatal.jmvstream.com/index.html?sid=1', 'https://jpimg.com.br/uploads/2025/04/900x900_natal-500x500.png', 'commercial', 8),
  ('jpnews', 'JP NEWS NATAL', '93,5 MHz', 'https://s02.maxcast.com.br:8082/', 'https://jpimg.com.br/uploads/2024/02/avatar-news-natal-rgb-500x500.png', 'commercial', 9),
  ('cidadefm', 'CIDADE FM NATAL', '94,3 MHz', 'https://cidadedosolaac.jmvstream.com', '/logos/cidade-fm.jpg', 'commercial', 10),
  ('104fm', '104 FM NATAL', '104,7 MHz', 'https://radios.braviahost.com.br:8000/', 'https://104fmprazeremouvir.com.br/assets/img/logo/logo-white.png', 'commercial', 11),
  ('universitariafm', 'UNIVERSITÁRIA FM', '88,9 MHz', 'https://radio.comunica.ufrn.br:8000', '/logos/universitaria-fm.png', 'commercial', 12),
  ('105fm', '105 FM NATAL', '105,9 MHz', 'https://stream2.svrdedicado.org:7031/stream', '/logos/105-fm.png', 'commercial', 13),
  ('nordeste925', 'FM NORDESTE EVANGÉLICA', '92,5 MHz', 'https://radio.midiaserverbr.com:9988/', '', 'religious', 14),
  ('marinhafm', 'MARINHA FM', '100,1 MHz', 'https://stm0.inovativa.net/listen/radiomarinha/', '', 'state', 15);
