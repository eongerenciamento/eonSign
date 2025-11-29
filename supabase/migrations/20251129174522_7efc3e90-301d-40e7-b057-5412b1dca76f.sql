-- Make address fields nullable in company_settings to allow signup without address
ALTER TABLE public.company_settings 
  ALTER COLUMN cep DROP NOT NULL,
  ALTER COLUMN street DROP NOT NULL,
  ALTER COLUMN neighborhood DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL;