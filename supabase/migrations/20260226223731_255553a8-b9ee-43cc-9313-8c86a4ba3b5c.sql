
-- Create school_subjects table
CREATE TABLE public.school_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject_type TEXT NOT NULL DEFAULT 'regular' CHECK (subject_type IN ('regular', 'gcrp')),
  show_in_report_card BOOLEAN NOT NULL DEFAULT true,
  show_in_planilla BOOLEAN NOT NULL DEFAULT true,
  evaluation_type TEXT NOT NULL DEFAULT 'numeric' CHECK (evaluation_type IN ('numeric', 'literal')),
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint for name per school
ALTER TABLE public.school_subjects ADD CONSTRAINT school_subjects_name_school_unique UNIQUE (school_id, name);

-- Enable RLS
ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all subjects" ON public.school_subjects FOR ALL USING (is_admin());

CREATE POLICY "School users can view their subjects" ON public.school_subjects FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = school_subjects.school_id));

CREATE POLICY "School users can insert their subjects" ON public.school_subjects FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = school_subjects.school_id));

CREATE POLICY "School users can update their subjects" ON public.school_subjects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = school_subjects.school_id));

-- No DELETE policy - subjects cannot be deleted, only suspended
