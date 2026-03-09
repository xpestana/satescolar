
-- Table to store editable final/definitive grades per student per assignment per momento
CREATE TABLE public.final_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  momento integer NOT NULL DEFAULT 1,
  grade_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, assignment_id, momento)
);

ALTER TABLE public.final_grades ENABLE ROW LEVEL SECURITY;

-- School users can manage final grades
CREATE POLICY "School users can manage final grades"
ON public.final_grades FOR ALL
TO public
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = final_grades.school_id))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = final_grades.school_id));

-- Admins can manage all final grades
CREATE POLICY "Admins can manage all final grades"
ON public.final_grades FOR ALL
TO public
USING (is_admin())
WITH CHECK (is_admin());

-- Teachers can view final grades for their assignments
CREATE POLICY "Teachers can view final grades"
ON public.final_grades FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM subject_teacher_assignments sta
  JOIN teachers t ON t.id = sta.teacher_id
  WHERE sta.id = final_grades.assignment_id AND t.user_id = auth.uid()
));
