-- Add column to documents table for facial biometry requirement
ALTER TABLE documents ADD COLUMN IF NOT EXISTS require_facial_biometry boolean DEFAULT false;

-- Add column to document_signers table for selfie URL
ALTER TABLE document_signers ADD COLUMN IF NOT EXISTS selfie_url text;

-- Create biometry storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('biometry', 'biometry', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for biometry bucket - only authenticated users can upload their own selfies
CREATE POLICY "Authenticated users can upload biometry"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'biometry' 
  AND auth.role() = 'authenticated'
);

-- Service role can read all biometry for document processing
CREATE POLICY "Service role can manage biometry"
ON storage.objects
FOR ALL
USING (bucket_id = 'biometry')
WITH CHECK (bucket_id = 'biometry');