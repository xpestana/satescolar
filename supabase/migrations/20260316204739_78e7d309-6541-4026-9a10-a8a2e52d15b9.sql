ALTER TABLE public.grades_config
  ADD COLUMN preschool_template text NOT NULL DEFAULT 'classic',
  ADD COLUMN primary_template text NOT NULL DEFAULT 'classic',
  ADD COLUMN secondary_template text NOT NULL DEFAULT 'classic';