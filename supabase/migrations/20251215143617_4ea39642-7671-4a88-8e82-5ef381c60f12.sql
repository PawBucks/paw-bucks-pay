-- Add auto_redeem_pawbucks preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS auto_redeem_pawbucks boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.auto_redeem_pawbucks IS 'When enabled, automatically applies available PawBucks balance to recurring subscription purchases at merchants that accept PawBucks';