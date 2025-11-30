-- Add birth_date column to document_signers table
ALTER TABLE public.document_signers 
ADD COLUMN birth_date DATE NULL;