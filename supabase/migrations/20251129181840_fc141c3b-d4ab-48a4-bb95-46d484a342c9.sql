-- Make email-assets bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'email-assets';

-- Create policy to allow public read access to email-assets
CREATE POLICY "Public read access for email assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'email-assets');