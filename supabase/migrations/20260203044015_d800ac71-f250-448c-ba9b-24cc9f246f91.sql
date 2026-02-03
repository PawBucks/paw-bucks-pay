
-- Make user_id nullable in transactions table so manual invoice payments can be recorded
-- even when the client email doesn't match a registered user
ALTER TABLE public.transactions ALTER COLUMN user_id DROP NOT NULL;

-- Add a comment explaining why this is nullable
COMMENT ON COLUMN public.transactions.user_id IS 'User ID of the pet owner. Nullable for manual invoice payments where client is not a registered user.';
