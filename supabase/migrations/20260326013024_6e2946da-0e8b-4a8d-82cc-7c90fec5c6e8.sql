
-- Representatives can view tokens for their family members (students and reps)
CREATE POLICY "Representatives can view their tokens"
ON public.attendance_tokens
FOR SELECT
TO authenticated
USING (
  (entity_type = 'representative' AND EXISTS (
    SELECT 1 FROM representatives r
    JOIN families f ON f.id = r.family_id
    WHERE r.id = attendance_tokens.entity_id AND f.user_id = auth.uid()
  ))
  OR
  (entity_type = 'student' AND EXISTS (
    SELECT 1 FROM students s
    JOIN families f ON f.id = s.family_id
    WHERE s.id = attendance_tokens.entity_id AND f.user_id = auth.uid()
  ))
);

-- Teachers can view their own tokens
CREATE POLICY "Teachers can view their tokens"
ON public.attendance_tokens
FOR SELECT
TO authenticated
USING (
  entity_type = 'teacher' AND EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = attendance_tokens.entity_id AND t.user_id = auth.uid()
  )
);
