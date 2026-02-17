
-- Create enrollment_planilla_sections table
CREATE TABLE public.enrollment_planilla_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  field_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enrollment_planilla_sections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage enrollment planilla sections"
ON public.enrollment_planilla_sections FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "School users can view their planilla sections"
ON public.enrollment_planilla_sections FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollment_planilla_sections.school_id
));

CREATE POLICY "School users can insert their planilla sections"
ON public.enrollment_planilla_sections FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollment_planilla_sections.school_id
));

CREATE POLICY "School users can update their planilla sections"
ON public.enrollment_planilla_sections FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollment_planilla_sections.school_id
));

CREATE POLICY "School users can delete their planilla sections"
ON public.enrollment_planilla_sections FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = enrollment_planilla_sections.school_id
));

-- Trigger for updated_at
CREATE TRIGGER update_enrollment_planilla_sections_updated_at
BEFORE UPDATE ON public.enrollment_planilla_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
