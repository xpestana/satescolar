-- Add primary_report_type to grades_config
ALTER TABLE public.grades_config
  ADD COLUMN IF NOT EXISTS primary_report_type text NOT NULL DEFAULT 'descriptive';

-- Create primary_grade_indicators table
CREATE TABLE public.primary_grade_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade_level text NOT NULL,
  area_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.primary_grade_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all primary indicators" ON public.primary_grade_indicators FOR ALL USING (is_admin());
CREATE POLICY "School users can view their primary indicators" ON public.primary_grade_indicators FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_grade_indicators.school_id));
CREATE POLICY "School users can insert their primary indicators" ON public.primary_grade_indicators FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_grade_indicators.school_id));
CREATE POLICY "School users can update their primary indicators" ON public.primary_grade_indicators FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_grade_indicators.school_id));
CREATE POLICY "School users can delete their primary indicators" ON public.primary_grade_indicators FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_grade_indicators.school_id));

-- Create primary_grading_scales table
CREATE TABLE public.primary_grading_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  abbreviation text NOT NULL,
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.primary_grading_scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all primary scales" ON public.primary_grading_scales FOR ALL USING (is_admin());
CREATE POLICY "School users can view their primary scales" ON public.primary_grading_scales FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_grading_scales.school_id));
CREATE POLICY "School users can insert their primary scales" ON public.primary_grading_scales FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_grading_scales.school_id));
CREATE POLICY "School users can update their primary scales" ON public.primary_grading_scales FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_grading_scales.school_id));
CREATE POLICY "School users can delete their primary scales" ON public.primary_grading_scales FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_grading_scales.school_id));