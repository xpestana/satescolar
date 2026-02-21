
-- Allow representatives to read planilla sections from their school
CREATE POLICY "Representatives can view planilla sections"
ON public.enrollment_planilla_sections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM family_schools fs
    JOIN families f ON f.id = fs.family_id
    WHERE fs.school_id = enrollment_planilla_sections.school_id
    AND f.user_id = auth.uid()
  )
);

-- Allow representatives to read planilla general config from their school
CREATE POLICY "Representatives can view planilla config"
ON public.planilla_general_config
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM family_schools fs
    JOIN families f ON f.id = fs.family_id
    WHERE fs.school_id = planilla_general_config.school_id
    AND f.user_id = auth.uid()
  )
);

-- Allow representatives to view their school
CREATE POLICY "Representatives can view their school"
ON public.schools
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM family_schools fs
    JOIN families f ON f.id = fs.family_id
    WHERE fs.school_id = schools.id
    AND f.user_id = auth.uid()
  )
);

-- Allow representatives to view school years of their school
CREATE POLICY "Representatives can view school years"
ON public.school_years
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM family_schools fs
    JOIN families f ON f.id = fs.family_id
    WHERE fs.school_id = school_years.school_id
    AND f.user_id = auth.uid()
  )
);

-- Allow representatives to view sections of their school
CREATE POLICY "Representatives can view sections"
ON public.sections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM family_schools fs
    JOIN families f ON f.id = fs.family_id
    WHERE fs.school_id = sections.school_id
    AND f.user_id = auth.uid()
  )
);

-- Allow representatives to read carnet config from their school
CREATE POLICY "Representatives can view carnet config"
ON public.carnet_config
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM family_schools fs
    JOIN families f ON f.id = fs.family_id
    WHERE fs.school_id = carnet_config.school_id
    AND f.user_id = auth.uid()
  )
);
