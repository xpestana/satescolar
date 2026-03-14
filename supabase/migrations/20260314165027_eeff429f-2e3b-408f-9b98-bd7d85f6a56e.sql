
-- Add preschool_report_type to grades_config
ALTER TABLE public.grades_config ADD COLUMN preschool_report_type text NOT NULL DEFAULT 'descriptive';

-- Preschool indicator components (equivalent to primary_indicator_areas)
CREATE TABLE public.preschool_indicator_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  level text NOT NULL,
  momento text NOT NULL,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preschool_indicator_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all preschool components" ON public.preschool_indicator_components FOR ALL USING (is_admin());
CREATE POLICY "School users can view their preschool components" ON public.preschool_indicator_components FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_indicator_components.school_id));
CREATE POLICY "School users can insert their preschool components" ON public.preschool_indicator_components FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_indicator_components.school_id));
CREATE POLICY "School users can update their preschool components" ON public.preschool_indicator_components FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_indicator_components.school_id));
CREATE POLICY "School users can delete their preschool components" ON public.preschool_indicator_components FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_indicator_components.school_id));

-- Preschool component indicators
CREATE TABLE public.preschool_component_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.preschool_indicator_components(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preschool_component_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all preschool indicators" ON public.preschool_component_indicators FOR ALL USING (is_admin());
CREATE POLICY "School users can view their preschool indicators" ON public.preschool_component_indicators FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_component_indicators.school_id));
CREATE POLICY "School users can insert their preschool indicators" ON public.preschool_component_indicators FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_component_indicators.school_id));
CREATE POLICY "School users can update their preschool indicators" ON public.preschool_component_indicators FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_component_indicators.school_id));
CREATE POLICY "School users can delete their preschool indicators" ON public.preschool_component_indicators FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_component_indicators.school_id));

-- Preschool grading scales
CREATE TABLE public.preschool_grading_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  abbreviation text NOT NULL,
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preschool_grading_scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all preschool scales" ON public.preschool_grading_scales FOR ALL USING (is_admin());
CREATE POLICY "School users can view their preschool scales" ON public.preschool_grading_scales FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_grading_scales.school_id));
CREATE POLICY "School users can insert their preschool scales" ON public.preschool_grading_scales FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_grading_scales.school_id));
CREATE POLICY "School users can update their preschool scales" ON public.preschool_grading_scales FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_grading_scales.school_id));
CREATE POLICY "School users can delete their preschool scales" ON public.preschool_grading_scales FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = preschool_grading_scales.school_id));
