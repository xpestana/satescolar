-- Create form field groups table
CREATE TABLE public.form_field_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  form_type form_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, form_type, name)
);

-- Add group_id to form_fields
ALTER TABLE public.form_fields 
ADD COLUMN group_id UUID REFERENCES public.form_field_groups(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.form_field_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for form_field_groups
CREATE POLICY "Admins can manage all form field groups" 
ON public.form_field_groups FOR ALL 
USING (is_admin());

CREATE POLICY "School users can view their form field groups" 
ON public.form_field_groups FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.school_id = form_field_groups.school_id
));

CREATE POLICY "School users can insert their form field groups" 
ON public.form_field_groups FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.school_id = form_field_groups.school_id
));

CREATE POLICY "School users can update their form field groups" 
ON public.form_field_groups FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.school_id = form_field_groups.school_id
));

CREATE POLICY "School users can delete their form field groups" 
ON public.form_field_groups FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.school_id = form_field_groups.school_id
));