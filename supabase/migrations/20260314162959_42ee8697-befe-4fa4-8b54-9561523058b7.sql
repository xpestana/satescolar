
-- Create areas table
CREATE TABLE public.primary_indicator_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade_level text NOT NULL,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.primary_indicator_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all indicator areas" ON public.primary_indicator_areas FOR ALL USING (is_admin());
CREATE POLICY "School users can view their indicator areas" ON public.primary_indicator_areas FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_indicator_areas.school_id));
CREATE POLICY "School users can insert their indicator areas" ON public.primary_indicator_areas FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_indicator_areas.school_id));
CREATE POLICY "School users can update their indicator areas" ON public.primary_indicator_areas FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_indicator_areas.school_id));
CREATE POLICY "School users can delete their indicator areas" ON public.primary_indicator_areas FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = primary_indicator_areas.school_id));
CREATE POLICY "Teachers can view indicator areas" ON public.primary_indicator_areas FOR SELECT USING (EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = auth.uid() AND t.school_id = primary_indicator_areas.school_id));

-- Add area_id to indicators table
ALTER TABLE public.primary_grade_indicators ADD COLUMN area_id uuid REFERENCES public.primary_indicator_areas(id) ON DELETE CASCADE;
