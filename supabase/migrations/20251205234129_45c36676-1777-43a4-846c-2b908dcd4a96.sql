-- Add professional_council column to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS professional_council text;

-- Add comment for documentation
COMMENT ON COLUMN public.company_settings.professional_council IS 'Professional council code (CRM, CRO, CRF, etc.) for healthcare professionals';