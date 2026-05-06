
-- =============================================================================
-- 1. INSERT NEW SERVICE: Store Rewards Pro
-- =============================================================================
INSERT INTO public.merchant_market_services (
  name, description, short_description, category, price_usd, price_pawbucks,
  billing_type, features, icon, is_active, is_popular, is_new, display_order
) VALUES (
  'Store Rewards Pro',
  'Run your own in-store PawBucks cash back rewards program. Issue store-locked PawBucks that customers can only redeem at your business — perfect for acquisition-only merchants who want to drive repeat visits without sharing rewards across the network.',
  'Your own in-store PawBucks rewards program',
  'growth',
  99,
  0,
  'monthly',
  '[
    "Issue store-locked PawBucks on every customer purchase",
    "Customers can only redeem PawBucks earned at your business",
    "Pre-fund your rewards wallet — full control of your loyalty budget",
    "Standard tier earn rates (10/20/30 PB per $1 by customer tier)",
    "Low-balance alerts and optional auto-reload",
    "Full reporting on issuance and redemption activity"
  ]'::jsonb,
  'gift',
  true,
  false,
  true,
  6
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. MERCHANT FUNDING WALLET
-- =============================================================================
CREATE TABLE public.merchant_store_rewards_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  lifetime_funded_cents BIGINT NOT NULL DEFAULT 0,
  lifetime_issued_pb BIGINT NOT NULL DEFAULT 0,
  lifetime_redeemed_pb BIGINT NOT NULL DEFAULT 0,
  low_balance_threshold_cents BIGINT NOT NULL DEFAULT 5000, -- $50 default
  auto_reload_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_reload_amount_cents BIGINT,
  low_balance_alert_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_msrw_merchant ON public.merchant_store_rewards_wallet(merchant_id);

ALTER TABLE public.merchant_store_rewards_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own funding wallet"
ON public.merchant_store_rewards_wallet FOR SELECT
USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all funding wallets"
ON public.merchant_store_rewards_wallet FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Service role manages funding wallets"
ON public.merchant_store_rewards_wallet FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role');

CREATE TRIGGER update_msrw_updated_at
  BEFORE UPDATE ON public.merchant_store_rewards_wallet
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 3. MERCHANT FUNDING ACTIVITY LEDGER
-- =============================================================================
CREATE TABLE public.merchant_store_rewards_funding_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topup','refund','issue','redeem_reversal','adjustment')),
  amount_cents BIGINT NOT NULL,           -- signed; positive = credit to merchant balance, negative = debit
  pb_amount BIGINT,                        -- nullable; populated for issue/redeem_reversal
  user_id UUID,                            -- nullable; populated when tied to a customer
  transaction_id UUID,
  stripe_payment_intent_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_msrfa_merchant ON public.merchant_store_rewards_funding_activity(merchant_id, created_at DESC);
CREATE INDEX idx_msrfa_user ON public.merchant_store_rewards_funding_activity(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.merchant_store_rewards_funding_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own funding activity"
ON public.merchant_store_rewards_funding_activity FOR SELECT
USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins view all funding activity"
ON public.merchant_store_rewards_funding_activity FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Service role manages funding activity"
ON public.merchant_store_rewards_funding_activity FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role');

-- =============================================================================
-- 4. STORE-LOCKED PAWBUCKS (PER USER × MERCHANT)
-- =============================================================================
CREATE TABLE public.store_locked_pawbucks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned BIGINT NOT NULL DEFAULT 0,
  lifetime_redeemed BIGINT NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, merchant_id)
);

CREATE INDEX idx_slpb_user ON public.store_locked_pawbucks(user_id);
CREATE INDEX idx_slpb_merchant ON public.store_locked_pawbucks(merchant_id);
CREATE INDEX idx_slpb_balance ON public.store_locked_pawbucks(user_id) WHERE balance > 0;

ALTER TABLE public.store_locked_pawbucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own store-locked balances"
ON public.store_locked_pawbucks FOR SELECT
USING (auth.uid() = user_id OR is_shared_member_of(user_id));

CREATE POLICY "Merchants view balances issued at their store"
ON public.store_locked_pawbucks FOR SELECT
USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all store-locked balances"
ON public.store_locked_pawbucks FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Service role manages store-locked balances"
ON public.store_locked_pawbucks FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role');

CREATE TRIGGER update_slpb_updated_at
  BEFORE UPDATE ON public.store_locked_pawbucks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 5. STORE-LOCKED PAWBUCKS ACTIVITY LEDGER
-- =============================================================================
CREATE TABLE public.store_locked_pawbucks_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earn','redeem')),
  amount BIGINT NOT NULL,
  transaction_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slpba_user ON public.store_locked_pawbucks_activity(user_id, created_at DESC);
CREATE INDEX idx_slpba_merchant ON public.store_locked_pawbucks_activity(merchant_id, created_at DESC);
CREATE INDEX idx_slpba_user_merchant ON public.store_locked_pawbucks_activity(user_id, merchant_id, created_at DESC);

ALTER TABLE public.store_locked_pawbucks_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own store-locked activity"
ON public.store_locked_pawbucks_activity FOR SELECT
USING (auth.uid() = user_id OR is_shared_member_of(user_id));

CREATE POLICY "Merchants view activity at their store"
ON public.store_locked_pawbucks_activity FOR SELECT
USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all store-locked activity"
ON public.store_locked_pawbucks_activity FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Service role manages store-locked activity"
ON public.store_locked_pawbucks_activity FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role');

-- =============================================================================
-- 6. HELPER: does this merchant have active Store Rewards Pro?
-- =============================================================================
CREATE OR REPLACE FUNCTION public.merchant_has_store_rewards_pro(p_merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.merchant_service_purchases msp
    JOIN public.merchant_market_services mms ON mms.id = msp.service_id
    WHERE msp.merchant_id = p_merchant_id
      AND mms.name = 'Store Rewards Pro'
      AND msp.status = 'active'
      AND (msp.expires_at IS NULL OR msp.expires_at > now())
  );
$$;

-- =============================================================================
-- 7. RPC: issue_store_locked_pawbucks
-- =============================================================================
CREATE OR REPLACE FUNCTION public.issue_store_locked_pawbucks(
  p_merchant_id UUID,
  p_user_id UUID,
  p_amount_pb BIGINT,
  p_transaction_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost_cents BIGINT;
  v_balance_cents BIGINT;
  v_new_balance BIGINT;
BEGIN
  IF p_amount_pb <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Cost: 1 PB = $0.001 = 0.1 cents. Round UP so merchant always covers it.
  v_cost_cents := CEIL(p_amount_pb::NUMERIC / 10.0)::BIGINT;

  -- Lock & verify funding wallet
  SELECT balance_cents INTO v_balance_cents
  FROM public.merchant_store_rewards_wallet
  WHERE merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_balance_cents IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Funding wallet not found');
  END IF;

  IF v_balance_cents < v_cost_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_funding',
      'required_cents', v_cost_cents,
      'available_cents', v_balance_cents
    );
  END IF;

  -- Debit funding wallet
  UPDATE public.merchant_store_rewards_wallet
  SET balance_cents = balance_cents - v_cost_cents,
      lifetime_issued_pb = lifetime_issued_pb + p_amount_pb
  WHERE merchant_id = p_merchant_id;

  -- Credit customer store-locked balance
  INSERT INTO public.store_locked_pawbucks (user_id, merchant_id, balance, lifetime_earned, last_activity_at)
  VALUES (p_user_id, p_merchant_id, p_amount_pb, p_amount_pb, now())
  ON CONFLICT (user_id, merchant_id) DO UPDATE
    SET balance = store_locked_pawbucks.balance + EXCLUDED.balance,
        lifetime_earned = store_locked_pawbucks.lifetime_earned + EXCLUDED.lifetime_earned,
        last_activity_at = now()
  RETURNING balance INTO v_new_balance;

  -- Log store-locked activity
  INSERT INTO public.store_locked_pawbucks_activity (user_id, merchant_id, type, amount, transaction_id, description)
  VALUES (p_user_id, p_merchant_id, 'earn', p_amount_pb, p_transaction_id,
          COALESCE(p_description, 'Earned in-store PawBucks'));

  -- Log funding activity
  INSERT INTO public.merchant_store_rewards_funding_activity
    (merchant_id, type, amount_cents, pb_amount, user_id, transaction_id, description)
  VALUES (p_merchant_id, 'issue', -v_cost_cents, p_amount_pb, p_user_id, p_transaction_id,
          COALESCE(p_description, 'Issued store-locked PawBucks'));

  RETURN jsonb_build_object(
    'success', true,
    'pb_issued', p_amount_pb,
    'cost_cents', v_cost_cents,
    'new_user_balance', v_new_balance,
    'new_funding_balance_cents', v_balance_cents - v_cost_cents
  );
END;
$$;

-- =============================================================================
-- 8. RPC: redeem_store_locked_pawbucks
-- =============================================================================
CREATE OR REPLACE FUNCTION public.redeem_store_locked_pawbucks(
  p_merchant_id UUID,
  p_user_id UUID,
  p_amount_pb BIGINT,
  p_transaction_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  IF p_amount_pb <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT balance INTO v_balance
  FROM public.store_locked_pawbucks
  WHERE user_id = p_user_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount_pb THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_balance',
      'available', COALESCE(v_balance, 0),
      'requested', p_amount_pb
    );
  END IF;

  UPDATE public.store_locked_pawbucks
  SET balance = balance - p_amount_pb,
      lifetime_redeemed = lifetime_redeemed + p_amount_pb,
      last_activity_at = now()
  WHERE user_id = p_user_id AND merchant_id = p_merchant_id;

  UPDATE public.merchant_store_rewards_wallet
  SET lifetime_redeemed_pb = lifetime_redeemed_pb + p_amount_pb
  WHERE merchant_id = p_merchant_id;

  INSERT INTO public.store_locked_pawbucks_activity (user_id, merchant_id, type, amount, transaction_id, description)
  VALUES (p_user_id, p_merchant_id, 'redeem', -p_amount_pb, p_transaction_id,
          COALESCE(p_description, 'Redeemed in-store PawBucks'));

  RETURN jsonb_build_object(
    'success', true,
    'pb_redeemed', p_amount_pb,
    'new_user_balance', v_balance - p_amount_pb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_has_store_rewards_pro(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.issue_store_locked_pawbucks(UUID, UUID, BIGINT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_store_locked_pawbucks(UUID, UUID, BIGINT, UUID, TEXT) TO service_role;
