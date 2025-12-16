-- Add column to store encrypted certificate password
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS certificate_password_encrypted TEXT;