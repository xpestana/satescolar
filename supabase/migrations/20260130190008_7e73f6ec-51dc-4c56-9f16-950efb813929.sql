-- Create enum for grade levels
CREATE TYPE public.grade_level AS ENUM (
  'pre_maternal',
  'maternal',
  'inicial',
  'primaria',
  'media_general',
  'media_tecnica'
);

-- Create sections table
CREATE TABLE public.sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade_level public.grade_level NOT NULL,
  name TEXT NOT NULL, -- e.g., "A", "B", "C"
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, grade_level, name)
);

-- Enable Row Level Security
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- School users can view their school's sections
CREATE POLICY "School users can view their sections"
ON public.sections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = sections.school_id
  )
);

-- School users can insert sections for their school
CREATE POLICY "School users can insert their sections"
ON public.sections
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = sections.school_id
  )
);

-- School users can update their school's sections
CREATE POLICY "School users can update their sections"
ON public.sections
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = sections.school_id
  )
);

-- School users can delete their school's sections
CREATE POLICY "School users can delete their sections"
ON public.sections
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = sections.school_id
  )
);

-- Admins can manage all sections
CREATE POLICY "Admins can manage all sections"
ON public.sections
FOR ALL
USING (public.is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_sections_updated_at
BEFORE UPDATE ON public.sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_sections_school_grade ON public.sections(school_id, grade_level);