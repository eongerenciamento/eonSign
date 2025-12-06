-- Add phone and email columns to patients table for prescription notifications
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text;