-- Add avatar_url column to company_settings for user avatar
-- logo_url will be used exclusively for company logo
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS avatar_url text;