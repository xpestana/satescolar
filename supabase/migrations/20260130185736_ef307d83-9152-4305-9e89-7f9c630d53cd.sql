-- Create enum for form types
CREATE TYPE public.form_type AS ENUM ('representative', 'student');

-- Create enum for field types (input types)
CREATE TYPE public.field_type AS ENUM (
  'text',
  'email', 
  'phone',
  'number',
  'date',
  'select',
  'textarea',
  'checkbox',
  'file'
);

-- Create form_fields table to store custom form configurations
CREATE TABLE public.form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  form_type public.form_type NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type public.field_type NOT NULL DEFAULT 'text',
  placeholder TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  field_order INTEGER NOT NULL DEFAULT 0,
  options JSONB, -- For select fields, stores array of options
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, form_type, field_name)
);

-- Enable Row Level Security
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

-- School users can view their school's form fields
CREATE POLICY "School users can view their form fields"
ON public.form_fields
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = form_fields.school_id
  )
);

-- School users can insert form fields for their school
CREATE POLICY "School users can insert their form fields"
ON public.form_fields
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = form_fields.school_id
  )
);

-- School users can update their school's form fields
CREATE POLICY "School users can update their form fields"
ON public.form_fields
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = form_fields.school_id
  )
);

-- School users can delete their school's form fields
CREATE POLICY "School users can delete their form fields"
ON public.form_fields
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = form_fields.school_id
  )
);

-- Admins can manage all form fields
CREATE POLICY "Admins can manage all form fields"
ON public.form_fields
FOR ALL
USING (public.is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_form_fields_updated_at
BEFORE UPDATE ON public.form_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_form_fields_school_type ON public.form_fields(school_id, form_type);