
-- Table: primary_final_reports
CREATE TABLE public.primary_final_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  momento integer NOT NULL DEFAULT 1,
  descriptive_report text DEFAULT '',
  literal text DEFAULT '',
  attendance_count integer DEFAULT 0,
  absence_count integer DEFAULT 0,
  final_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, assignment_id, momento)
);

ALTER TABLE public.primary_final_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all primary final reports" ON public.primary_final_reports FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view primary final reports" ON public.primary_final_reports FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_final_reports.school_id));
CREATE POLICY "School users can manage primary final reports" ON public.primary_final_reports FOR ALL TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_final_reports.school_id)) WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_final_reports.school_id));
CREATE POLICY "Teachers can manage their primary final reports" ON public.primary_final_reports FOR ALL TO public USING (EXISTS (SELECT 1 FROM subject_teacher_assignments sta JOIN teachers t ON t.id = sta.teacher_id WHERE sta.id = primary_final_reports.assignment_id AND t.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM subject_teacher_assignments sta JOIN teachers t ON t.id = sta.teacher_id WHERE sta.id = primary_final_reports.assignment_id AND t.user_id = auth.uid()));

-- Table: primary_final_indicator_grades
CREATE TABLE public.primary_final_indicator_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  momento integer NOT NULL,
  indicator_id uuid NOT NULL REFERENCES public.primary_grade_indicators(id) ON DELETE CASCADE,
  scale_id uuid REFERENCES public.primary_grading_scales(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, assignment_id, momento, indicator_id)
);

ALTER TABLE public.primary_final_indicator_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all primary indicator grades" ON public.primary_final_indicator_grades FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can manage primary indicator grades" ON public.primary_final_indicator_grades FOR ALL TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_final_indicator_grades.school_id)) WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_final_indicator_grades.school_id));
CREATE POLICY "Teachers can manage their primary indicator grades" ON public.primary_final_indicator_grades FOR ALL TO public USING (EXISTS (SELECT 1 FROM subject_teacher_assignments sta JOIN teachers t ON t.id = sta.teacher_id WHERE sta.id = primary_final_indicator_grades.assignment_id AND t.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM subject_teacher_assignments sta JOIN teachers t ON t.id = sta.teacher_id WHERE sta.id = primary_final_indicator_grades.assignment_id AND t.user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_primary_final_reports_updated_at BEFORE UPDATE ON public.primary_final_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_primary_final_indicator_grades_updated_at BEFORE UPDATE ON public.primary_final_indicator_grades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
