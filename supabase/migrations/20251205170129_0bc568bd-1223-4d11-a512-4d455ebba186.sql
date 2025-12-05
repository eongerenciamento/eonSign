-- Add columns for certificate emission and PFX storage
ALTER TABLE certificate_requests
ADD COLUMN IF NOT EXISTS emission_url TEXT,
ADD COLUMN IF NOT EXISTS pfx_data TEXT,
ADD COLUMN IF NOT EXISTS pfx_password TEXT,
ADD COLUMN IF NOT EXISTS certificate_serial TEXT,
ADD COLUMN IF NOT EXISTS certificate_valid_from TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS certificate_valid_until TIMESTAMPTZ;