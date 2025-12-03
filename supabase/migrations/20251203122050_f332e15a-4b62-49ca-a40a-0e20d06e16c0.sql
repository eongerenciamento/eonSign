-- Create enum for member roles
CREATE TYPE public.member_role AS ENUM ('admin', 'member');

-- Create organization_members table
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL, -- user_id do admin/owner
  member_email TEXT NOT NULL,
  member_user_id UUID, -- preenchido após aceite do convite
  role member_role NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'inactive'
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, member_email)
);

-- Enable RLS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is admin of an organization
CREATE OR REPLACE FUNCTION public.is_organization_admin(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = _organization_id
$$;

-- Security definer function to get user's organization_id (as admin or member)
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM organization_members WHERE member_user_id = _user_id AND status = 'active' LIMIT 1),
    _user_id
  )
$$;

-- Admins can view all members of their organization
CREATE POLICY "Admins can view organization members"
ON public.organization_members
FOR SELECT
USING (public.is_organization_admin(auth.uid(), organization_id));

-- Admins can create members in their organization
CREATE POLICY "Admins can create organization members"
ON public.organization_members
FOR INSERT
WITH CHECK (public.is_organization_admin(auth.uid(), organization_id));

-- Admins can update members in their organization
CREATE POLICY "Admins can update organization members"
ON public.organization_members
FOR UPDATE
USING (public.is_organization_admin(auth.uid(), organization_id));

-- Admins can delete members from their organization
CREATE POLICY "Admins can delete organization members"
ON public.organization_members
FOR DELETE
USING (public.is_organization_admin(auth.uid(), organization_id));

-- Members can view their own membership record
CREATE POLICY "Members can view their own membership"
ON public.organization_members
FOR SELECT
USING (member_user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_organization_members_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();