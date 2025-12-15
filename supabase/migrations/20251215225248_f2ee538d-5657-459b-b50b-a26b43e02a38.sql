-- Add admin_birth_date column to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN admin_birth_date date;