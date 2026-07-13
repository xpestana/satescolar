CREATE TABLE public.resumen_final_config (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_year_id   uuid        NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  section_id       uuid        NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  parte            integer     NOT NULL DEFAULT 1,
  tipo_planilla    text        NOT NULL DEFAULT '31059',
  observaciones    text        NOT NULL DEFAULT '',
  nombre_profesor  text        NOT NULL DEFAULT '',
  cedula_profesor  text        NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, school_year_id, section_id, parte)
);

ALTER TABLE public.resumen_final_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_users_resumen_final"
  ON public.resumen_final_config FOR ALL
  USING (school_id IN (
    SELECT school_id FROM public.user_roles WHERE user_id = auth.uid()
  ));
