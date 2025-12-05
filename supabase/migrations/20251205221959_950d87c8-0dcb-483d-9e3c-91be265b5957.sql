-- Add healthcare professional fields to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS is_healthcare BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS professional_registration TEXT,
ADD COLUMN IF NOT EXISTS registration_state TEXT;