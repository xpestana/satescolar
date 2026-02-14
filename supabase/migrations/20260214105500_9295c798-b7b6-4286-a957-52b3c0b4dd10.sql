
-- ============================================
-- Phase 1: Create junction tables, migrate data, update RLS
-- ============================================

-- 1. Create family_schools junction table
CREATE TABLE public.family_schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, school_id)
);

-- 2. Create student_schools junction table
CREATE TABLE public.student_schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, school_id)
);

-- 3. Enable RLS
ALTER TABLE public.family_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_schools ENABLE ROW LEVEL SECURITY;

-- 4. Migrate existing data
INSERT INTO public.family_schools (family_id, school_id)
SELECT id, school_id FROM public.families WHERE school_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.student_schools (student_id, school_id)
SELECT id, school_id FROM public.students WHERE school_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. RLS for family_schools
CREATE POLICY "Admins can manage all family_schools"
ON public.family_schools FOR ALL USING (is_admin());

CREATE POLICY "School users can view their family associations"
ON public.family_schools FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = family_schools.school_id));

CREATE POLICY "School users can insert family associations"
ON public.family_schools FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = family_schools.school_id));

CREATE POLICY "School users can delete family associations"
ON public.family_schools FOR DELETE
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = family_schools.school_id));

CREATE POLICY "Representatives can view their family associations"
ON public.family_schools FOR SELECT
USING (EXISTS (SELECT 1 FROM families WHERE families.id = family_schools.family_id AND families.user_id = auth.uid()));

-- 6. RLS for student_schools
CREATE POLICY "Admins can manage all student_schools"
ON public.student_schools FOR ALL USING (is_admin());

CREATE POLICY "School users can manage their student associations"
ON public.student_schools FOR ALL
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = student_schools.school_id));

CREATE POLICY "Representatives can view their student associations"
ON public.student_schools FOR SELECT
USING (EXISTS (
  SELECT 1 FROM families f JOIN students s ON s.family_id = f.id
  WHERE s.id = student_schools.student_id AND f.user_id = auth.uid()
));

-- 7. Update families RLS to use junction table
DROP POLICY IF EXISTS "School users can insert families" ON public.families;
DROP POLICY IF EXISTS "School users can update their families" ON public.families;
DROP POLICY IF EXISTS "School users can view their families" ON public.families;

CREATE POLICY "School users can view their families"
ON public.families FOR SELECT
USING (EXISTS (
  SELECT 1 FROM family_schools fs JOIN user_roles ur ON ur.school_id = fs.school_id
  WHERE fs.family_id = families.id AND ur.user_id = auth.uid()
));

CREATE POLICY "School users can insert families"
ON public.families FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('school', 'admin')
));

CREATE POLICY "School users can update their families"
ON public.families FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM family_schools fs JOIN user_roles ur ON ur.school_id = fs.school_id
  WHERE fs.family_id = families.id AND ur.user_id = auth.uid()
));

-- 8. Update students RLS to use junction table
DROP POLICY IF EXISTS "School users can manage their students" ON public.students;

CREATE POLICY "School users can view their students"
ON public.students FOR SELECT
USING (EXISTS (
  SELECT 1 FROM student_schools ss JOIN user_roles ur ON ur.school_id = ss.school_id
  WHERE ss.student_id = students.id AND ur.user_id = auth.uid()
));

CREATE POLICY "School users can insert students"
ON public.students FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('school', 'admin')
));

CREATE POLICY "School users can update their students"
ON public.students FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM student_schools ss JOIN user_roles ur ON ur.school_id = ss.school_id
  WHERE ss.student_id = students.id AND ur.user_id = auth.uid()
));

CREATE POLICY "School users can delete their students"
ON public.students FOR DELETE
USING (EXISTS (
  SELECT 1 FROM student_schools ss JOIN user_roles ur ON ur.school_id = ss.school_id
  WHERE ss.student_id = students.id AND ur.user_id = auth.uid()
));

-- 9. Update representatives RLS to use family → family_schools
DROP POLICY IF EXISTS "School users can manage their representatives" ON public.representatives;

CREATE POLICY "School users can manage their representatives"
ON public.representatives FOR ALL
USING (EXISTS (
  SELECT 1 FROM family_schools fs JOIN user_roles ur ON ur.school_id = fs.school_id
  WHERE fs.family_id = representatives.family_id AND ur.user_id = auth.uid()
));

-- 10. Drop old school_id columns (data already migrated to junction tables)
ALTER TABLE public.representatives DROP COLUMN school_id;
ALTER TABLE public.families DROP COLUMN school_id;
ALTER TABLE public.students DROP COLUMN school_id;
