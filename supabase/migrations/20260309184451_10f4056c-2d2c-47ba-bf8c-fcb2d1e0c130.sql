
-- Add auto-redeem mode and smart parameters to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS auto_redeem_mode text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS auto_redeem_min_coverage_pct integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS auto_redeem_max_apply_pct integer NOT NULL DEFAULT 50;

-- Migrate existing toggle values
UPDATE public.profiles 
SET auto_redeem_mode = CASE WHEN auto_redeem_pawbucks = true THEN 'subscriptions_only' ELSE 'off' END;
