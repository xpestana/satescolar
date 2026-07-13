ALTER TABLE public.planilla_general_config
  ADD COLUMN IF NOT EXISTS school_header jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS education_codes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rfre_config jsonb NOT NULL DEFAULT '{}'::jsonb;
