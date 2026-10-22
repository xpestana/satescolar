-- Diagnóstico del estudiante (Ficha descriptiva), módulo Notas.
--
-- student_diagnoses: one row per student × assignment (docente × área × sección × año), so every
-- teacher writes their own diagnosis for their área. The three sections are HTML from the rich text
-- editor; an empty section is not printed.
--
-- grades_config.diagnosis_signatures: institutional signatures printed after the teacher's own
-- signature (teacher_signatures): [{ nombre, cedula, cargo, firma_url, sello_url, enabled }].
--
-- Representatives have no access for now.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.student_diagnoses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id     uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id  uuid        NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  strengths      text        NOT NULL DEFAULT '',
  weaknesses     text        NOT NULL DEFAULT '',
  improvements   text        NOT NULL DEFAULT '',
  updated_by     uuid        DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, assignment_id)
);

CREATE INDEX IF NOT EXISTS student_diagnoses_assignment_idx ON public.student_diagnoses (assignment_id);

DROP TRIGGER IF EXISTS update_student_diagnoses_updated_at ON public.student_diagnoses;
CREATE TRIGGER update_student_diagnoses_updated_at
BEFORE UPDATE ON public.student_diagnoses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all student diagnoses" ON public.student_diagnoses;
CREATE POLICY "Admins can manage all student diagnoses" ON public.student_diagnoses AS PERMISSIVE FOR ALL TO public
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only school staff: user_roles also holds teachers and representatives.
DROP POLICY IF EXISTS "School users can manage student diagnoses" ON public.student_diagnoses;
CREATE POLICY "School users can manage student diagnoses" ON public.student_diagnoses AS PERMISSIVE FOR ALL TO public
  USING (public.is_school_staff(school_id))
  WITH CHECK (public.is_school_staff(school_id));

-- The teacher of the assignment, and only rows of that assignment's school.
DROP POLICY IF EXISTS "Teachers can manage their student diagnoses" ON public.student_diagnoses;
CREATE POLICY "Teachers can manage their student diagnoses" ON public.student_diagnoses AS PERMISSIVE FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.subject_teacher_assignments sta
    JOIN public.teachers t ON t.id = sta.teacher_id
    WHERE sta.id = student_diagnoses.assignment_id AND t.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subject_teacher_assignments sta
    JOIN public.teachers t ON t.id = sta.teacher_id
    WHERE sta.id = student_diagnoses.assignment_id
      AND sta.school_id = student_diagnoses.school_id
      AND t.user_id = auth.uid()
  ));

-- Module gate (Notas), same rule as 20261006120000_school_modules_write_policies.
DROP POLICY IF EXISTS module_gate_insert ON public.student_diagnoses;
CREATE POLICY module_gate_insert ON public.student_diagnoses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.school_has_module(school_id, 'grades'));

DROP POLICY IF EXISTS module_gate_update ON public.student_diagnoses;
CREATE POLICY module_gate_update ON public.student_diagnoses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.school_has_module(school_id, 'grades'))
  WITH CHECK (public.is_admin() OR public.school_has_module(school_id, 'grades'));

ALTER TABLE public.grades_config
  ADD COLUMN IF NOT EXISTS diagnosis_signatures jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
