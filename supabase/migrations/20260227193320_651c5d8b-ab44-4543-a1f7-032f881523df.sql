
CREATE TABLE public.grades_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  use_percentage_plan BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT grades_config_school_unique UNIQUE (school_id)
);

ALTER TABLE public.grades_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all grades config" ON public.grades_config FOR ALL USING (is_admin());
CREATE POLICY "School users can view their grades config" ON public.grades_config FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = grades_config.school_id));
CREATE POLICY "School users can insert their grades config" ON public.grades_config FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = grades_config.school_id));
CREATE POLICY "School users can update their grades config" ON public.grades_config FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = grades_config.school_id));
