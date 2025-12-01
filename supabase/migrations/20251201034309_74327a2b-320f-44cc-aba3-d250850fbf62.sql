-- Add IP address column to document_signers table
ALTER TABLE document_signers ADD COLUMN signature_ip text;