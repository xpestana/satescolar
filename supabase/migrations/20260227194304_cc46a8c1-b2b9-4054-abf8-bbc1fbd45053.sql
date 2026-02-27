-- Allow teachers to view carnet_config for their school
CREATE POLICY "Teachers can view their school carnet config"
ON public.carnet_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.user_id = auth.uid()
    AND t.school_id = carnet_config.school_id
  )
);

-- Allow teachers to view their school info
CREATE POLICY "Teachers can view their school"
ON public.schools
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.user_id = auth.uid()
    AND t.school_id = schools.id
  )
);

-- Allow teachers to view school years of their school
CREATE POLICY "Teachers can view school years"
ON public.school_years
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.user_id = auth.uid()
    AND t.school_id = school_years.school_id
  )
);

-- Allow teachers to view their own assignments
CREATE POLICY "Teachers can view own assignments"
ON public.subject_teacher_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.user_id = auth.uid()
    AND t.id = subject_teacher_assignments.teacher_id
  )
);

-- Allow teachers to view subjects of their school
CREATE POLICY "Teachers can view school subjects"
ON public.school_subjects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.user_id = auth.uid()
    AND t.school_id = school_subjects.school_id
  )
);