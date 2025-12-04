-- Create signer_groups table
CREATE TABLE public.signer_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create signer_group_members table (links groups to contacts)
CREATE TABLE public.signer_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.signer_groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.signer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signer_group_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for signer_groups
CREATE POLICY "Users can view their own groups"
ON public.signer_groups FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own groups"
ON public.signer_groups FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups"
ON public.signer_groups FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups"
ON public.signer_groups FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for signer_group_members (based on group ownership)
CREATE POLICY "Users can view members of their groups"
ON public.signer_group_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.signer_groups 
  WHERE signer_groups.id = signer_group_members.group_id 
  AND signer_groups.user_id = auth.uid()
));

CREATE POLICY "Users can add members to their groups"
ON public.signer_group_members FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.signer_groups 
  WHERE signer_groups.id = signer_group_members.group_id 
  AND signer_groups.user_id = auth.uid()
));

CREATE POLICY "Users can remove members from their groups"
ON public.signer_group_members FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.signer_groups 
  WHERE signer_groups.id = signer_group_members.group_id 
  AND signer_groups.user_id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_signer_groups_updated_at
BEFORE UPDATE ON public.signer_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();