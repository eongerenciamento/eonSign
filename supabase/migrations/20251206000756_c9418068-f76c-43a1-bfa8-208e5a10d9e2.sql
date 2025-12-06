-- Add healthcare professional address fields to company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS healthcare_cep text,
ADD COLUMN IF NOT EXISTS healthcare_street text,
ADD COLUMN IF NOT EXISTS healthcare_neighborhood text,
ADD COLUMN IF NOT EXISTS healthcare_city text,
ADD COLUMN IF NOT EXISTS healthcare_state text;