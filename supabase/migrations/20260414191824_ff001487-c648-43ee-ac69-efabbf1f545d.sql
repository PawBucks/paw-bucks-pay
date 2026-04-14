
-- Make user_id nullable so admin can create brand before user exists
ALTER TABLE public.brand_accounts ALTER COLUMN user_id DROP NOT NULL;

-- Add invitation columns
ALTER TABLE public.brand_accounts 
  ADD COLUMN invitation_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN invitation_email TEXT,
  ADD COLUMN invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN invitation_claimed_at TIMESTAMPTZ;

-- Create index on invitation_token for fast lookups
CREATE INDEX idx_brand_accounts_invitation_token ON public.brand_accounts(invitation_token);

-- Allow public SELECT by invitation_token (for the brand setup page)
CREATE POLICY "Anyone can view brand account by invitation token"
ON public.brand_accounts
FOR SELECT
USING (
  invitation_token IS NOT NULL 
  AND invitation_claimed_at IS NULL
);

-- Allow authenticated users to update their own brand account (to claim it)
CREATE POLICY "Users can claim their brand account"
ON public.brand_accounts
FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND invitation_token IS NOT NULL 
  AND invitation_claimed_at IS NULL
)
WITH CHECK (
  auth.uid() = user_id
);
