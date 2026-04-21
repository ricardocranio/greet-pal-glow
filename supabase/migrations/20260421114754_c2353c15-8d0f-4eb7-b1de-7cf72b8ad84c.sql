
-- Create pracas table
CREATE TABLE public.pracas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on name+state
ALTER TABLE public.pracas ADD CONSTRAINT pracas_name_state_unique UNIQUE (name, state);

-- Enable RLS
ALTER TABLE public.pracas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pracas" ON public.pracas FOR SELECT USING (true);
CREATE POLICY "Only service role can insert pracas" ON public.pracas FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update pracas" ON public.pracas FOR UPDATE USING (false);
CREATE POLICY "Only service role can delete pracas" ON public.pracas FOR DELETE USING (false);

-- Add praca_id to stations
ALTER TABLE public.stations ADD COLUMN praca_id UUID REFERENCES public.pracas(id) ON DELETE SET NULL;

-- Create storage bucket for station logos
INSERT INTO storage.buckets (id, name, public) VALUES ('station-logos', 'station-logos', true);

-- Storage policies for logos
CREATE POLICY "Anyone can view station logos" ON storage.objects FOR SELECT USING (bucket_id = 'station-logos');
CREATE POLICY "Service role can upload station logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'station-logos');
CREATE POLICY "Service role can update station logos" ON storage.objects FOR UPDATE USING (bucket_id = 'station-logos');
CREATE POLICY "Service role can delete station logos" ON storage.objects FOR DELETE USING (bucket_id = 'station-logos');
