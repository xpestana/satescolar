-- Allow school users to delete their own payments (cascades to items and method entries)
CREATE POLICY "School users can delete their payments"
ON public.payments
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = payments.school_id
));