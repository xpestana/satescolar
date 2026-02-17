
-- Table to store student enrollments (inscripciones)
CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(student_id, school_year_id, school_id)
);

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all enrollments"
ON public.enrollments FOR ALL
USING (is_admin());

CREATE POLICY "School users can view their enrollments"
ON public.enrollments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollments.school_id
));

CREATE POLICY "School users can insert their enrollments"
ON public.enrollments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollments.school_id
));

CREATE POLICY "School users can update their enrollments"
ON public.enrollments FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollments.school_id
));

CREATE POLICY "School users can delete their enrollments"
ON public.enrollments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollments.school_id
));

-- Representatives can view their students' enrollments
CREATE POLICY "Representatives can view their student enrollments"
ON public.enrollments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students s
  JOIN families f ON f.id = s.family_id
  WHERE s.id = enrollments.student_id
  AND f.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_enrollments_updated_at
BEFORE UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Table to configure which student fields are shown in the enrollment modal
CREATE TABLE public.enrollment_display_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(school_id, field_name)
);

ALTER TABLE public.enrollment_display_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage enrollment display config"
ON public.enrollment_display_config FOR ALL
USING (is_admin());

CREATE POLICY "School users can view their enrollment display config"
ON public.enrollment_display_config FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollment_display_config.school_id
));

CREATE POLICY "School users can insert their enrollment display config"
ON public.enrollment_display_config FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollment_display_config.school_id
));

CREATE POLICY "School users can update their enrollment display config"
ON public.enrollment_display_config FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollment_display_config.school_id
));

CREATE POLICY "School users can delete their enrollment display config"
ON public.enrollment_display_config FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollment_display_config.school_id
));

CREATE TRIGGER update_enrollment_display_config_updated_at
BEFORE UPDATE ON public.enrollment_display_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
