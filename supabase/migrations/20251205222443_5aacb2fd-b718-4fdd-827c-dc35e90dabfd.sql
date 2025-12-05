-- Add medical specialty field to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS medical_specialty TEXT;