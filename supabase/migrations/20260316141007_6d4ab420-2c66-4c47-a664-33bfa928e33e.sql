
-- Preschool final reports table (mirrors primary_final_reports)
CREATE TABLE public.preschool_final_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  momento integer NOT NULL DEFAULT 1,
  literal text DEFAULT '',
  descriptive_report text DEFAULT '',
  project_name text DEFAULT '',
  attendance_count integer DEFAULT 0,
  absence_count integer DEFAULT 0,
  final_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, assignment_id, momento)
);

-- Preschool final indicator grades table
CREATE TABLE public.preschool_final_indicator_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  momento integer NOT NULL,
  indicator_id uuid NOT NULL REFERENCES public.preschool_component_indicators(id) ON DELETE CASCADE,
  scale_id uuid REFERENCES public.preschool_grading_scales(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, assignment_id, momento, indicator_id)
);

-- RLS for preschool_final_reports
ALTER TABLE public.preschool_final_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all preschool final reports"
  ON public.preschool_final_reports FOR ALL TO public
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "School users can manage preschool final reports"
  ON public.preschool_final_reports FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_final_reports.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_final_reports.school_id));

CREATE POLICY "Teachers can manage their preschool final reports"
  ON public.preschool_final_reports FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM subject_teacher_assignments sta JOIN teachers t ON t.id = sta.teacher_id WHERE sta.id = preschool_final_reports.assignment_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM subject_teacher_assignments sta JOIN teachers t ON t.id = sta.teacher_id WHERE sta.id = preschool_final_reports.assignment_id AND t.user_id = auth.uid()));

-- RLS for preschool_final_indicator_grades
ALTER TABLE public.preschool_final_indicator_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all preschool indicator grades"
  ON public.preschool_final_indicator_grades FOR ALL TO public
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "School users can manage preschool indicator grades"
  ON public.preschool_final_indicator_grades FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_final_indicator_grades.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_final_indicator_grades.school_id));

CREATE POLICY "Teachers can manage their preschool indicator grades"
  ON public.preschool_final_indicator_grades FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM subject_teacher_assignments sta JOIN teachers t ON t.id = sta.teacher_id WHERE sta.id = preschool_final_indicator_grades.assignment_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM subject_teacher_assignments sta JOIN teachers t ON t.id = sta.teacher_id WHERE sta.id = preschool_final_indicator_grades.assignment_id AND t.user_id = auth.uid()));
