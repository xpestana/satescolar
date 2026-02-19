
-- Carnet configuration table for school customization
CREATE TABLE public.carnet_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  primary_color TEXT NOT NULL DEFAULT '#01051e',
  secondary_color TEXT NOT NULL DEFAULT '#1e78c8',
  watermark_url TEXT,
  watermark_opacity NUMERIC(3,2) NOT NULL DEFAULT 0.06,
  watermark_size NUMERIC(5,1) NOT NULL DEFAULT 30.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT carnet_config_school_id_unique UNIQUE (school_id)
);

ALTER TABLE public.carnet_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users can view their carnet config"
ON public.carnet_config FOR SELECT
USING (public.user_shares_school(auth.uid(), school_id));

CREATE POLICY "School users can insert their carnet config"
ON public.carnet_config FOR INSERT
WITH CHECK (public.user_shares_school(auth.uid(), school_id));

CREATE POLICY "School users can update their carnet config"
ON public.carnet_config FOR UPDATE
USING (public.user_shares_school(auth.uid(), school_id));

-- Add trigger for updated_at
CREATE TRIGGER update_carnet_config_updated_at
BEFORE UPDATE ON public.carnet_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
