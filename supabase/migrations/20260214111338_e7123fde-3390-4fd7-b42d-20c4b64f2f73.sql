
-- Drop existing restrictive policies on students
DROP POLICY IF EXISTS "Admins can manage all students" ON public.students;
DROP POLICY IF EXISTS "Representatives can update their students" ON public.students;
DROP POLICY IF EXISTS "Representatives can view their students" ON public.students;
DROP POLICY IF EXISTS "School users can delete their students" ON public.students;
DROP POLICY IF EXISTS "School users can insert students" ON public.students;
DROP POLICY IF EXISTS "School users can update their students" ON public.students;
DROP POLICY IF EXISTS "School users can view their students" ON public.students;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all students"
ON public.students FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Representatives can update their students"
ON public.students FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM families WHERE families.id = students.family_id AND families.user_id = auth.uid()));

CREATE POLICY "Representatives can view their students"
ON public.students FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM families WHERE families.id = students.family_id AND families.user_id = auth.uid()));

CREATE POLICY "School users can delete their students"
ON public.students FOR DELETE
TO authenticated
USING (user_has_school_access_to_student(auth.uid(), id));

CREATE POLICY "School users can insert students"
ON public.students FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY (ARRAY['school'::app_role, 'admin'::app_role])));

CREATE POLICY "School users can update their students"
ON public.students FOR UPDATE
TO authenticated
USING (user_has_school_access_to_student(auth.uid(), id));

CREATE POLICY "School users can view their students"
ON public.students FOR SELECT
TO authenticated
USING (user_has_school_access_to_student(auth.uid(), id));
