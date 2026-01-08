-- Add invite_token column for tracking invitation links
ALTER TABLE public.shared_account_members 
ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;

-- Create index for quick token lookup
CREATE INDEX IF NOT EXISTS idx_shared_account_members_invite_token 
ON public.shared_account_members(invite_token) 
WHERE invite_token IS NOT NULL;