
CREATE TABLE public.subject_teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.school_subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subject_teacher_year_unique UNIQUE (subject_id, teacher_id, school_year_id)
);

ALTER TABLE public.subject_teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all assignments" ON public.subject_teacher_assignments FOR ALL USING (is_admin());

CREATE POLICY "School users can view their assignments" ON public.subject_teacher_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = subject_teacher_assignments.school_id)
);

CREATE POLICY "School users can insert their assignments" ON public.subject_teacher_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = subject_teacher_assignments.school_id)
);

CREATE POLICY "School users can update their assignments" ON public.subject_teacher_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = subject_teacher_assignments.school_id)
);

CREATE POLICY "School users can delete their assignments" ON public.subject_teacher_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = subject_teacher_assignments.school_id)
);
