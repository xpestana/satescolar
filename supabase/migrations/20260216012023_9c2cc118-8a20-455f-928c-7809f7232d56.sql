
CREATE POLICY "School users can delete their families"
ON public.families
FOR DELETE
USING (
  public.user_has_school_access_to_family(auth.uid(), id)
);
