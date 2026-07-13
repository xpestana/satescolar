-- Storage RLS policies for payment-receipts bucket.
-- Path format: {school_id}/{family_id}/{filename}
-- Representatives can upload/read under their own family folder.
-- School users can read all receipts for their school.

-- Upload: representative can write under any school_id/their_family_id/
CREATE POLICY "Representatives can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.user_id = auth.uid()
      AND (storage.foldername(name))[2] = f.id::text
  )
);

-- Read: representative can read files in their family folder
CREATE POLICY "Representatives can read own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.user_id = auth.uid()
      AND (storage.foldername(name))[2] = f.id::text
  )
);

-- Read: school users can read all receipts uploaded for their school
CREATE POLICY "School users can read receipts of their school"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.school_id::text = (storage.foldername(name))[1]
  )
);
