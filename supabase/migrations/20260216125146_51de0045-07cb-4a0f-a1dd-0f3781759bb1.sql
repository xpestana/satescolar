-- Allow school users to view roles of users associated with their school
CREATE POLICY "School users can view roles in their school"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.school_id = user_roles.school_id
  )
);