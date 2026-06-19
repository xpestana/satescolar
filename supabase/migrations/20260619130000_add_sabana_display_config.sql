ALTER TABLE public.planilla_general_config
  ADD COLUMN IF NOT EXISTS sabana_display_config jsonb NOT NULL DEFAULT '{}'::jsonb;
