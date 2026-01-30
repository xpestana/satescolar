-- Create school_years table to store academic years for each school
CREATE TABLE public.school_years (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  year_range TEXT NOT NULL, -- Format: "2025-2026"
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, year_range)
);

-- Enable Row Level Security
ALTER TABLE public.school_years ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- School users can view their own school's years
CREATE POLICY "School users can view their school years"
ON public.school_years
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = school_years.school_id
  )
);

-- School users can insert years for their school
CREATE POLICY "School users can insert their school years"
ON public.school_years
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = school_years.school_id
  )
);

-- School users can update their school's years
CREATE POLICY "School users can update their school years"
ON public.school_years
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = school_years.school_id
  )
);

-- School users can delete their school's years
CREATE POLICY "School users can delete their school years"
ON public.school_years
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = school_years.school_id
  )
);

-- Admins can manage all school years
CREATE POLICY "Admins can manage all school years"
ON public.school_years
FOR ALL
USING (public.is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_school_years_updated_at
BEFORE UPDATE ON public.school_years
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();