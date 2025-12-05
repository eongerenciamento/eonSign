-- Add columns for rejection reason and revoked timestamp
ALTER TABLE certificate_requests
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;