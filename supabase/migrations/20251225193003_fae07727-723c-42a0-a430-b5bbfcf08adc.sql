-- Add invitation token columns to organization_members
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS invitation_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_organization_members_invitation_token 
ON public.organization_members(invitation_token) 
WHERE invitation_token IS NOT NULL;