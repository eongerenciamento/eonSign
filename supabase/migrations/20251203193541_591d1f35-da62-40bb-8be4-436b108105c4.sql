-- Adicionar colunas para integração BRy na tabela documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS bry_envelope_uuid TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS bry_document_uuid TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS bry_signed_file_url TEXT;

-- Adicionar colunas para signatários BRy
ALTER TABLE document_signers ADD COLUMN IF NOT EXISTS bry_signer_nonce TEXT;
ALTER TABLE document_signers ADD COLUMN IF NOT EXISTS bry_signer_link TEXT;