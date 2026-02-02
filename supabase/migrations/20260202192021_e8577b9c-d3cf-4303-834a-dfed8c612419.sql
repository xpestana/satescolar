-- Create student status enum
CREATE TYPE public.student_status AS ENUM ('active', 'suspended', 'graduated', 'completed');

-- Create families table
CREATE TABLE public.families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  father_last_name TEXT,
  mother_last_name TEXT,
  contact_phone TEXT,
  state_id UUID REFERENCES public.states(id),
  municipality_id UUID REFERENCES public.municipalities(id),
  city_id UUID REFERENCES public.cities(id),
  parish_id UUID REFERENCES public.parishes(id),
  address TEXT,
  additional_phone TEXT,
  monthly_income NUMERIC,
  income_contributor TEXT,
  dependents_count INTEGER,
  transport_companion TEXT,
  transport_method TEXT,
  parents_marital_status TEXT,
  religion TEXT,
  emergency_contact TEXT,
  property_ownership TEXT,
  housing_type TEXT,
  rooms_count INTEGER,
  monthly_housing_payment TEXT,
  housing_sector TEXT,
  housing_details TEXT,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  photo_url TEXT,
  document_id TEXT,
  status student_status NOT NULL DEFAULT 'active',
  form_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create representatives table
CREATE TABLE public.representatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  photo_url TEXT,
  document_id TEXT,
  phone TEXT,
  email TEXT,
  form_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representatives ENABLE ROW LEVEL SECURITY;

-- Families RLS policies
CREATE POLICY "Admins can manage all families"
ON public.families FOR ALL USING (is_admin());

CREATE POLICY "School users can view their families"
ON public.families FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = families.school_id
));

CREATE POLICY "School users can insert families"
ON public.families FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = families.school_id
));

CREATE POLICY "School users can update their families"
ON public.families FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = families.school_id
));

CREATE POLICY "Representatives can view their family"
ON public.families FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Representatives can update their family"
ON public.families FOR UPDATE
USING (auth.uid() = user_id);

-- Students RLS policies
CREATE POLICY "Admins can manage all students"
ON public.students FOR ALL USING (is_admin());

CREATE POLICY "School users can manage their students"
ON public.students FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = students.school_id
));

CREATE POLICY "Representatives can view their students"
ON public.students FOR SELECT
USING (EXISTS (
  SELECT 1 FROM families
  WHERE families.id = students.family_id
  AND families.user_id = auth.uid()
));

CREATE POLICY "Representatives can update their students"
ON public.students FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM families
  WHERE families.id = students.family_id
  AND families.user_id = auth.uid()
));

-- Representatives RLS policies
CREATE POLICY "Admins can manage all representatives"
ON public.representatives FOR ALL USING (is_admin());

CREATE POLICY "School users can manage their representatives"
ON public.representatives FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = representatives.school_id
));

CREATE POLICY "Family representatives can view their reps"
ON public.representatives FOR SELECT
USING (EXISTS (
  SELECT 1 FROM families
  WHERE families.id = representatives.family_id
  AND families.user_id = auth.uid()
));

CREATE POLICY "Family representatives can manage their reps"
ON public.representatives FOR ALL
USING (EXISTS (
  SELECT 1 FROM families
  WHERE families.id = representatives.family_id
  AND families.user_id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_families_updated_at
BEFORE UPDATE ON public.families
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_representatives_updated_at
BEFORE UPDATE ON public.representatives
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for family photos
INSERT INTO storage.buckets (id, name, public) VALUES ('family-photos', 'family-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for family photos
CREATE POLICY "Anyone can view family photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'family-photos');

CREATE POLICY "Authenticated users can upload family photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'family-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update family photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'family-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete family photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'family-photos' AND auth.role() = 'authenticated');