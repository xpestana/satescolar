
-- Create storage bucket for school assets (watermarks, etc.)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their school folder
CREATE POLICY "School users can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'school-assets' AND auth.role() = 'authenticated');

CREATE POLICY "School users can update assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'school-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view school assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'school-assets');
