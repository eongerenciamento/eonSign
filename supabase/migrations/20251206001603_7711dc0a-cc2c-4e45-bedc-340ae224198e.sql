-- Add patient_name column to documents for prescriptions
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS patient_name text;