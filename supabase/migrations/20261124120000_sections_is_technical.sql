-- Secundaria (1er–6to Año) sections can be técnica or not. Existing rows stay non-technical.
ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS is_technical boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sections.is_technical IS
  'True when the section belongs to Media Técnica. Printed as "A (Técnica)".';
