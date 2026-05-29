ALTER TABLE public.planilla_general_config
  ADD COLUMN IF NOT EXISTS planilla_title text NOT NULL DEFAULT 'PLANILLA';
