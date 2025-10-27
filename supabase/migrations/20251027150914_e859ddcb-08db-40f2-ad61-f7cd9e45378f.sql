-- ========================================
-- MAJOR SCHEMA REFACTORING FOR PETALPAY
-- This migration modifies existing tables to match exact specifications
-- ========================================

-- 1. MODIFY PROFILES TABLE (users equivalent)
-- Add role column and stripe_customer_id
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Update existing users: map user_type to role
UPDATE public.profiles 
SET role = CASE 
  WHEN user_type = 'merchant' THEN 'merchant'
  ELSE 'user'
END;

-- Note: Keep user_type for backward compatibility during transition
-- Can be removed in future migration if needed

-- 2. RENAME PET_PROFILES COLUMNS TO MATCH SPEC
ALTER TABLE public.pet_profiles 
  RENAME COLUMN pet_name TO name;
  
ALTER TABLE public.pet_profiles 
  RENAME COLUMN pet_type TO type;

-- 3. MODIFY MERCHANTS TABLE
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS funding_status text DEFAULT 'none';

-- Copy contact_person to owner_name for existing records
UPDATE public.merchants 
SET owner_name = contact_person 
WHERE owner_name IS NULL;

-- Map stripe_account_status to funding_status
UPDATE public.merchants
SET funding_status = CASE
  WHEN stripe_account_status = 'active' THEN 'approved'
  WHEN stripe_account_status = 'pending' THEN 'pending'
  ELSE 'none'
END;

-- 4. MODIFY TRANSACTIONS TABLE
ALTER TABLE public.transactions
  RENAME COLUMN pet_owner_id TO user_id;
  
ALTER TABLE public.transactions
  RENAME COLUMN cashback_amount TO cashback_earned;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- 5. MODIFY WALLETS TABLE
ALTER TABLE public.wallets
  RENAME COLUMN updated_at TO last_updated;

-- Remove columns that are not in spec (but keep them commented for safety)
-- ALTER TABLE public.wallets DROP COLUMN IF EXISTS total_spent;
-- ALTER TABLE public.wallets DROP COLUMN IF EXISTS rewards_points;
-- ALTER TABLE public.wallets DROP COLUMN IF EXISTS created_at;

-- 6. MODIFY WALLET_ACTIVITY TABLE
-- Add wallet_id foreign key
ALTER TABLE public.wallet_activity
  ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE;

-- Populate wallet_id from user_id for existing records
UPDATE public.wallet_activity wa
SET wallet_id = w.id
FROM public.wallets w
WHERE wa.user_id = w.user_id AND wa.wallet_id IS NULL;

-- Rename activity_type to type
ALTER TABLE public.wallet_activity
  RENAME COLUMN activity_type TO type;

-- 7. MODIFY FUNDING_REQUESTS TABLE
-- Remove estimated_monthly_sales (keep commented for safety)
-- ALTER TABLE public.funding_requests DROP COLUMN IF EXISTS estimated_monthly_sales;
-- ALTER TABLE public.funding_requests DROP COLUMN IF EXISTS updated_at;

-- 8. CREATE SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active',
  start_date timestamp with time zone NOT NULL DEFAULT now(),
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
ON public.subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
ON public.subscriptions FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- 9. CREATE SUBSCRIPTION_EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on subscription_events
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_events
CREATE POLICY "Users can view their subscription events"
ON public.subscription_events FOR SELECT
USING (
  subscription_id IN (
    SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage all subscription events"
ON public.subscription_events FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- 10. UPDATE EXISTING RLS POLICIES TO USE NEW COLUMN NAMES

-- Update transactions policies for user_id rename
DROP POLICY IF EXISTS "Pet owners can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Only service role can create transactions" ON public.transactions;
CREATE POLICY "Only service role can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Update wallet_activity policies for type rename
DROP POLICY IF EXISTS "System can insert wallet activity" ON public.wallet_activity;
CREATE POLICY "System can insert wallet activity"
ON public.wallet_activity FOR INSERT
WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON public.subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_payment_intent ON public.transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_wallet_activity_wallet_id ON public.wallet_activity(wallet_id);

-- Add comments for documentation
COMMENT ON TABLE public.subscriptions IS 'User subscription records linked to Stripe';
COMMENT ON TABLE public.subscription_events IS 'Event history for subscription lifecycle';
COMMENT ON COLUMN public.profiles.role IS 'User role: user, merchant, or admin';
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID for payment processing';
COMMENT ON COLUMN public.merchants.funding_status IS 'Merchant funding status: none, pending, approved, denied';
COMMENT ON COLUMN public.transactions.stripe_payment_intent_id IS 'Stripe PaymentIntent ID for this transaction';
