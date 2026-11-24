-- Specialty (mención) of a técnica section, typed by the school. Used later by the
-- resumen final planillas. NULL for non-technical sections and for rows created before it.
ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS technical_specialty text;

COMMENT ON COLUMN public.sections.technical_specialty IS
  'Especialidad of a técnica section (is_technical = true). NULL otherwise.';
