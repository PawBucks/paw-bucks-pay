-- Create table for shared account members
CREATE TABLE public.shared_account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_id, member_email)
);

-- Enable RLS
ALTER TABLE public.shared_account_members ENABLE ROW LEVEL SECURITY;

-- Owners can manage their shared members
CREATE POLICY "Owners can view their shared members"
ON public.shared_account_members
FOR SELECT
USING (auth.uid() = owner_id OR auth.uid() = member_id);

CREATE POLICY "Owners can insert shared members"
ON public.shared_account_members
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their shared members"
ON public.shared_account_members
FOR UPDATE
USING (auth.uid() = owner_id OR auth.uid() = member_id);

CREATE POLICY "Owners can delete their shared members"
ON public.shared_account_members
FOR DELETE
USING (auth.uid() = owner_id);

-- Create index for faster lookups
CREATE INDEX idx_shared_account_members_owner ON public.shared_account_members(owner_id);
CREATE INDEX idx_shared_account_members_member ON public.shared_account_members(member_id);
CREATE INDEX idx_shared_account_members_email ON public.shared_account_members(member_email);

-- Trigger for updated_at
CREATE TRIGGER update_shared_account_members_updated_at
BEFORE UPDATE ON public.shared_account_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();