-- Add columns for native simple signature
ALTER TABLE document_signers ADD COLUMN IF NOT EXISTS signature_id uuid DEFAULT gen_random_uuid();
ALTER TABLE document_signers ADD COLUMN IF NOT EXISTS signature_x numeric;
ALTER TABLE document_signers ADD COLUMN IF NOT EXISTS signature_y numeric;
ALTER TABLE document_signers ADD COLUMN IF NOT EXISTS signature_page integer DEFAULT 1;
ALTER TABLE document_signers ADD COLUMN IF NOT EXISTS typed_signature text;

-- Add signature_mode to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_mode text DEFAULT 'SIMPLE';