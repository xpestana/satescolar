-- Certificación de Notas (Certificación de Calificaciones EMG), pestaña de /planillas.
--
-- grade_certificates: one row per student with everything the school captures for the form.
--   institutions  → schools where the student studied (free text, up to 5):
--                   [{ id, name, locality, federalEntity, isOwnSchool }]
--   year_records  → one item per year (1–5): áreas de formación with their grade, T-E, month, year
--                   and institution, plus the Orientación y Convivencia literal and the group (GCRP):
--                   [{ yearLevel, grades: [{ id, subjectName, grade, evaluationType, month, year,
--                      institutionId, sourceSubjectId }], orientationLiteral, groupName, groupLiteral }]
--   issue_date    → fecha de expedición; NULL = the day the certificate is issued.
-- The grades are a snapshot: they can be synced from final_grades (momento = 0) but they are edited
-- freely here, because a student may have studied some years in another school. The document is
-- stored as JSON in a single row so it is always saved as a whole.
--
-- planilla_general_config.grade_certificate_config: data of the form saved once per school
--   { cdcee, issue_place, cdcee_director_name, cdcee_director_document }.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.grade_certificates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id    uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  institutions  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  year_records  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  observations  text        NOT NULL DEFAULT '',
  issue_date    date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id)
);

DROP TRIGGER IF EXISTS update_grade_certificates_updated_at ON public.grade_certificates;
CREATE TRIGGER update_grade_certificates_updated_at
BEFORE UPDATE ON public.grade_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.grade_certificates ENABLE ROW LEVEL SECURITY;

-- Only school staff: user_roles also holds teachers and representatives.
DROP POLICY IF EXISTS "school_staff_grade_certificates" ON public.grade_certificates;
CREATE POLICY "school_staff_grade_certificates" ON public.grade_certificates AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(school_id))
  WITH CHECK (public.is_school_staff(school_id));

-- Module gate (Planillajes del Ministerio), same rule as 20261006120000_school_modules_write_policies.
DROP POLICY IF EXISTS module_gate_insert ON public.grade_certificates;
CREATE POLICY module_gate_insert ON public.grade_certificates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.school_has_module(school_id, 'ministry_forms'));

DROP POLICY IF EXISTS module_gate_update ON public.grade_certificates;
CREATE POLICY module_gate_update ON public.grade_certificates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.school_has_module(school_id, 'ministry_forms'))
  WITH CHECK (public.is_admin() OR public.school_has_module(school_id, 'ministry_forms'));

ALTER TABLE public.planilla_general_config
  ADD COLUMN IF NOT EXISTS grade_certificate_config jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
