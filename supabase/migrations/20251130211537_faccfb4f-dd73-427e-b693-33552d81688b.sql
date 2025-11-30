-- Add geolocation fields to document_signers table
ALTER TABLE document_signers
ADD COLUMN signature_latitude DECIMAL(10, 8),
ADD COLUMN signature_longitude DECIMAL(11, 8),
ADD COLUMN signature_city TEXT,
ADD COLUMN signature_state TEXT,
ADD COLUMN signature_country TEXT;