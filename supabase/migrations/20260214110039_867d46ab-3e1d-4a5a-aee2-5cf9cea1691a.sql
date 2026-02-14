
-- Drop all existing policies on family_schools to fix recursion
DROP POLICY IF EXISTS "Admins can manage all family_schools" ON public.family_schools;
DROP POLICY IF EXISTS "Representatives can view their family associations" ON public.family_schools;
DROP POLICY IF EXISTS "School users can delete family associations" ON public.family_schools;
DROP POLICY IF EXISTS "School users can insert family associations" ON public.family_schools;
DROP POLICY IF EXISTS "School users can view their family associations" ON public.family_schools;

-- Drop all existing policies on families
DROP POLICY IF EXISTS "Admins can manage all families" ON public.families;
DROP POLICY IF EXISTS "Representatives can update their family" ON public.families;
DROP POLICY IF EXISTS "Representatives can view their family" ON public.families;
DROP POLICY IF EXISTS "School users can insert families" ON public.families;
DROP POLICY IF EXISTS "School users can update their families" ON public.families;
DROP POLICY IF EXISTS "School users can view their families" ON public.families;

-- Drop all existing policies on student_schools
DROP POLICY IF EXISTS "Admins can manage all student_schools" ON public.student_schools;
DROP POLICY IF EXISTS "Representatives can view their student associations" ON public.student_schools;
DROP POLICY IF EXISTS "School users can manage their student associations" ON public.student_schools;

-- Drop all existing policies on students
DROP POLICY IF EXISTS "Admins can manage all students" ON public.students;
DROP POLICY IF EXISTS "Representatives can update their students" ON public.students;
DROP POLICY IF EXISTS "Representatives can view their students" ON public.students;
DROP POLICY IF EXISTS "School users can delete their students" ON public.students;
DROP POLICY IF EXISTS "School users can insert students" ON public.students;
DROP POLICY IF EXISTS "School users can update their students" ON public.students;
DROP POLICY IF EXISTS "School users can view their students" ON public.students;

-- =============================================
-- FAMILY_SCHOOLS policies (NO reference to families table)
-- =============================================
CREATE POLICY "Admins can manage all family_schools"
ON public.family_schools FOR ALL
USING (is_admin());

-- School users: check directly against user_roles, no join to families
CREATE POLICY "School users can view their family_schools"
ON public.family_schools FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = family_schools.school_id
));

CREATE POLICY "School users can insert family_schools"
ON public.family_schools FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = family_schools.school_id
));

CREATE POLICY "School users can delete family_schools"
ON public.family_schools FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = family_schools.school_id
));

-- Representatives can view their own family associations
CREATE POLICY "Representatives can view their family_schools"
ON public.family_schools FOR SELECT
USING (EXISTS (
  SELECT 1 FROM families
  WHERE families.id = family_schools.family_id
    AND families.user_id = auth.uid()
));

-- =============================================
-- FAMILIES policies (use security definer function to avoid recursion)
-- =============================================

-- Create a security definer function to check school access to a family
CREATE OR REPLACE FUNCTION public.user_has_school_access_to_family(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM family_schools fs
    JOIN user_roles ur ON ur.school_id = fs.school_id
    WHERE fs.family_id = _family_id
      AND ur.user_id = _user_id
  )
$$;

CREATE POLICY "Admins can manage all families"
ON public.families FOR ALL
USING (is_admin());

CREATE POLICY "Representatives can view their family"
ON public.families FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Representatives can update their family"
ON public.families FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "School users can view their families"
ON public.families FOR SELECT
USING (public.user_has_school_access_to_family(auth.uid(), id));

CREATE POLICY "School users can update their families"
ON public.families FOR UPDATE
USING (public.user_has_school_access_to_family(auth.uid(), id));

CREATE POLICY "School users can insert families"
ON public.families FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('school', 'admin')
));

-- =============================================
-- STUDENT_SCHOOLS policies (NO reference to students)
-- =============================================
CREATE POLICY "Admins can manage all student_schools"
ON public.student_schools FOR ALL
USING (is_admin());

CREATE POLICY "School users can manage their student_schools"
ON public.student_schools FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = student_schools.school_id
));

CREATE POLICY "Representatives can view their student_schools"
ON public.student_schools FOR SELECT
USING (EXISTS (
  SELECT 1 FROM families f
  JOIN students s ON s.family_id = f.id
  WHERE s.id = student_schools.student_id
    AND f.user_id = auth.uid()
));

-- =============================================
-- STUDENTS policies (use security definer to avoid recursion)
-- =============================================

CREATE OR REPLACE FUNCTION public.user_has_school_access_to_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM student_schools ss
    JOIN user_roles ur ON ur.school_id = ss.school_id
    WHERE ss.student_id = _student_id
      AND ur.user_id = _user_id
  )
$$;

CREATE POLICY "Admins can manage all students"
ON public.students FOR ALL
USING (is_admin());

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

CREATE POLICY "School users can view their students"
ON public.students FOR SELECT
USING (public.user_has_school_access_to_student(auth.uid(), id));

CREATE POLICY "School users can update their students"
ON public.students FOR UPDATE
USING (public.user_has_school_access_to_student(auth.uid(), id));

CREATE POLICY "School users can delete their students"
ON public.students FOR DELETE
USING (public.user_has_school_access_to_student(auth.uid(), id));

CREATE POLICY "School users can insert students"
ON public.students FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('school', 'admin')
));
