
-- Make section_id nullable for GCRP assignments
ALTER TABLE public.subject_teacher_assignments ALTER COLUMN section_id DROP NOT NULL;

-- Drop old unique constraint and create new one allowing NULL section_id
ALTER TABLE public.subject_teacher_assignments
  DROP CONSTRAINT IF EXISTS subject_teacher_year_section_unique;

-- Create table for GCRP individual student assignments
CREATE TABLE public.gcrp_assignment_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE public.gcrp_assignment_students ENABLE ROW LEVEL SECURITY;

-- RLS: School users can manage
CREATE POLICY "School users can manage gcrp students"
  ON public.gcrp_assignment_students FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = gcrp_assignment_students.school_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = gcrp_assignment_students.school_id
  ));

-- RLS: Teachers can view their GCRP students
CREATE POLICY "Teachers can view their gcrp students"
  ON public.gcrp_assignment_students FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM subject_teacher_assignments sta
    JOIN teachers t ON t.id = sta.teacher_id
    WHERE sta.id = gcrp_assignment_students.assignment_id
    AND t.user_id = auth.uid()
  ));

-- RLS: Admins
CREATE POLICY "Admins can manage all gcrp students"
  ON public.gcrp_assignment_students FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
