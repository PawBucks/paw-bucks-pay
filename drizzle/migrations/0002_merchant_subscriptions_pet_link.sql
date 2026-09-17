ALTER TABLE public.merchant_subscriptions
  ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pet_name TEXT;

CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_pet ON public.merchant_subscriptions(pet_id);

-- One active subscription per (user, merchant, plan, pet). Different pets may
-- each hold their own subscription to the same plan; rows without a pet keep
-- the legacy one-per-plan behavior via a separate partial index.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_merchant_sub_per_pet
  ON public.merchant_subscriptions(user_id, merchant_id, stripe_price_id, pet_id)
  WHERE status IN ('active','trialing') AND pet_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_merchant_sub_no_pet
  ON public.merchant_subscriptions(user_id, merchant_id, stripe_price_id)
  WHERE status IN ('active','trialing') AND pet_id IS NULL;