CREATE TABLE public.resumen_final_subject_overrides (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_year_id       uuid        NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  planilla_type        text        NOT NULL CHECK (planilla_type IN ('31059', '31060')),
  subject_id           uuid        NOT NULL REFERENCES public.school_subjects(id) ON DELETE CASCADE,
  custom_name          text,
  custom_abbreviation  text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, school_year_id, planilla_type, subject_id)
);

ALTER TABLE public.resumen_final_subject_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_users_resumen_final_subject_overrides"
  ON public.resumen_final_subject_overrides FOR ALL
  USING (school_id IN (
    SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()
  ));
