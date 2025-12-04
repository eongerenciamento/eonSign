-- Add signature_mode column to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS signature_mode text DEFAULT 'SIMPLE';

-- Add comment explaining the column
COMMENT ON COLUMN public.documents.signature_mode IS 'Signature mode: SIMPLE, ADVANCED, or QUALIFIED';