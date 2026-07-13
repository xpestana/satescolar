-- Add new subject types: orientacion and innovacion_tecnologica_productiva
ALTER TABLE public.school_subjects
  DROP CONSTRAINT IF EXISTS school_subjects_subject_type_check;

ALTER TABLE public.school_subjects
  ADD CONSTRAINT school_subjects_subject_type_check
  CHECK (subject_type IN ('regular', 'gcrp', 'orientacion', 'innovacion_tecnologica_productiva'));
