
CREATE TABLE public.student_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  evaluation_plan_item_id uuid NOT NULL REFERENCES public.evaluation_plan_items(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id),
  grade_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, evaluation_plan_item_id)
);

ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

-- Teachers can manage grades for their own assignments
CREATE POLICY "Teachers can manage their grades"
  ON public.student_grades
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.subject_teacher_assignments sta
      JOIN public.teachers t ON t.id = sta.teacher_id
      WHERE sta.id = student_grades.assignment_id
        AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subject_teacher_assignments sta
      JOIN public.teachers t ON t.id = sta.teacher_id
      WHERE sta.id = student_grades.assignment_id
        AND t.user_id = auth.uid()
    )
  );

-- School users can view grades
CREATE POLICY "School users can view grades"
  ON public.student_grades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.school_id = student_grades.school_id
    )
  );

-- Admins can manage all grades
CREATE POLICY "Admins can manage all grades"
  ON public.student_grades
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
