-- Add certificate columns to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS certificate_file_url TEXT;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS certificate_subject TEXT;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS certificate_issuer TEXT;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS certificate_valid_from TIMESTAMPTZ;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS certificate_valid_to TIMESTAMPTZ;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS certificate_serial_number TEXT;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS certificate_uploaded_at TIMESTAMPTZ;

-- Create certificates storage bucket (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for certificates bucket
CREATE POLICY "Users can upload their own certificates"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own certificates"
ON storage.objects FOR SELECT 
USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own certificates"
ON storage.objects FOR DELETE 
USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own certificates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);