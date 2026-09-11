-- ============================================================
-- Referral Program v2
-- Pet Parent referrers earn PawBucks; Pet Pro referrers earn USD credit.
-- ============================================================

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referee_user_type text,
  ADD COLUMN IF NOT EXISTS referrer_is_pro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referee_subscription_tier text,
  ADD COLUMN IF NOT EXISTS signup_bonus_awarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_sales_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pro_sales_bonus_awarded boolean NOT NULL DEFAULT false;

-- Ledger of every referral reward issued (idempotency + history)
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL,
  reward_type text NOT NULL,
  amount_pb integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL DEFAULT 0,
  period_month date NOT NULL DEFAULT DATE '1900-01-01',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their own referral rewards" ON public.referral_rewards;
CREATE POLICY "Users view their own referral rewards"
  ON public.referral_rewards FOR SELECT TO authenticated
  USING (auth.uid() = beneficiary_id);

CREATE UNIQUE INDEX IF NOT EXISTS referral_rewards_unique_award
  ON public.referral_rewards (referral_id, reward_type, period_month);
CREATE INDEX IF NOT EXISTS referral_rewards_beneficiary_idx
  ON public.referral_rewards (beneficiary_id, created_at DESC);

-- USD referral credit balance for Pet Pros (merchants & vets)
CREATE TABLE IF NOT EXISTS public.pet_pro_referral_credits (
  user_id uuid PRIMARY KEY,
  balance_cents integer NOT NULL DEFAULT 0,
  lifetime_earned_cents integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pet_pro_referral_credits TO authenticated;
GRANT ALL ON public.pet_pro_referral_credits TO service_role;
ALTER TABLE public.pet_pro_referral_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pros view their own referral credits" ON public.pet_pro_referral_credits;
CREATE POLICY "Pros view their own referral credits"
  ON public.pet_pro_referral_credits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_pet_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.merchants WHERE user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.partner_vets WHERE user_id = _user_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_pet_pro(uuid) TO anon, authenticated, service_role;

-- Credit PawBucks to a user's wallet + activity ledger (promotional, non-expiring)
CREATE OR REPLACE FUNCTION public.credit_referral_pawbucks(
  _user_id uuid,
  _amount_pb integer,
  _description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount_pb IS NULL OR _amount_pb <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.pawbucks_wallet (user_id, balance)
  VALUES (_user_id, _amount_pb)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.pawbucks_wallet.balance + EXCLUDED.balance,
        last_updated = now();

  INSERT INTO public.pawbucks_activity
    (user_id, type, amount, source, description, pawbucks_status)
  VALUES
    (_user_id, 'earn', _amount_pb, 'referral_bonus', _description, 'available');
END;
$$;

-- Credit USD referral credit to a Pet Pro
CREATE OR REPLACE FUNCTION public.credit_pet_pro_referral_usd(
  _user_id uuid,
  _amount_cents integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.pet_pro_referral_credits (user_id, balance_cents, lifetime_earned_cents)
  VALUES (_user_id, _amount_cents, _amount_cents)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_cents = public.pet_pro_referral_credits.balance_cents + EXCLUDED.balance_cents,
        lifetime_earned_cents = public.pet_pro_referral_credits.lifetime_earned_cents + EXCLUDED.lifetime_earned_cents,
        updated_at = now();
END;
$$;

-- ------------------------------------------------------------
-- 1) Signup-time rewards
--    * every referred new member gets 10,000 PawBucks (pet parents)
--    * pet-parent referrer earns 25,000 PB when they refer a Pet Pro account
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_referral_signup_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referee_type text;
  v_referrer_is_pro boolean;
BEGIN
  SELECT COALESCE(NEW.referee_user_type, p.user_type) INTO v_referee_type
  FROM public.profiles p WHERE p.id = NEW.referee_id;

  v_referrer_is_pro := public.is_pet_pro(NEW.referrer_id);

  UPDATE public.referrals
  SET referee_user_type = v_referee_type,
      referrer_is_pro = v_referrer_is_pro
  WHERE id = NEW.id;

  -- Welcome bonus for the referred pet parent
  IF COALESCE(v_referee_type, 'pet_owner') = 'pet_owner' THEN
    BEGIN
      INSERT INTO public.referral_rewards
        (referral_id, beneficiary_id, reward_type, amount_pb, description)
      VALUES
        (NEW.id, NEW.referee_id, 'referee_signup_bonus', 10000,
         'Referral welcome bonus - 10,000 PawBucks');

      PERFORM public.credit_referral_pawbucks(
        NEW.referee_id, 10000, 'Referral welcome bonus');

      UPDATE public.referrals SET signup_bonus_awarded = true WHERE id = NEW.id;

      INSERT INTO public.notifications (user_id, title, message, category)
      VALUES (NEW.referee_id, 'Welcome bonus added',
              'You joined with a referral code and earned 10,000 PawBucks.', 'promotional');
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END IF;

  -- Pet Parent refers a new Pet Pro account -> 25,000 PawBucks
  IF v_referee_type IN ('merchant', 'vet', 'admin') IS NOT TRUE THEN
    NULL;
  END IF;

  IF COALESCE(v_referee_type, '') IN ('merchant', 'vet') AND NOT v_referrer_is_pro THEN
    BEGIN
      INSERT INTO public.referral_rewards
        (referral_id, beneficiary_id, reward_type, amount_pb, description)
      VALUES
        (NEW.id, NEW.referrer_id, 'parent_refers_pro', 25000,
         'Referred a new Pet Pro account - 25,000 PawBucks');

      PERFORM public.credit_referral_pawbucks(
        NEW.referrer_id, 25000, 'Referral reward - new Pet Pro joined');

      UPDATE public.referrals SET referrer_bonus_awarded = true WHERE id = NEW.id;

      INSERT INTO public.notifications (user_id, title, message, category)
      VALUES (NEW.referrer_id, 'Referral reward earned',
              'A Pet Pro you referred joined PawBucks. You earned 25,000 PawBucks.', 'promotional');
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referral_signup_rewards_trigger ON public.referrals;
CREATE TRIGGER referral_signup_rewards_trigger
AFTER INSERT ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.handle_referral_signup_rewards();

-- ------------------------------------------------------------
-- 2) Membership rewards (called after a membership payment clears)
--    Pet Parent referrer: 10,000 PB (PawPass) / 20,000 PB (PawPass+), one time
--    Pet Pro referrer:    $1 (PawPass) / $2 (PawPass+) every paid month
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_referral_subscription_reward(
  p_referee_id uuid,
  p_tier text,
  p_period_start timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_is_pro boolean;
  v_pb integer := 0;
  v_cents integer := 0;
  v_period date := date_trunc('month', COALESCE(p_period_start, now()))::date;
  v_tier text := lower(COALESCE(p_tier, ''));
BEGIN
  IF v_tier NOT IN ('pawpass', 'pawpass_plus') THEN
    RETURN jsonb_build_object('awarded', false, 'reason', 'unsupported_tier');
  END IF;

  SELECT * INTO r FROM public.referrals WHERE referee_id = p_referee_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('awarded', false, 'reason', 'no_referral');
  END IF;

  UPDATE public.referrals SET referee_subscription_tier = v_tier WHERE id = r.id;

  v_is_pro := public.is_pet_pro(r.referrer_id);

  IF v_is_pro THEN
    v_cents := CASE WHEN v_tier = 'pawpass_plus' THEN 200 ELSE 100 END;

    BEGIN
      INSERT INTO public.referral_rewards
        (referral_id, beneficiary_id, reward_type, amount_cents, period_month, description)
      VALUES
        (r.id, r.referrer_id,
         CASE WHEN v_tier = 'pawpass_plus' THEN 'pro_recurring_pawpass_plus' ELSE 'pro_recurring_pawpass' END,
         v_cents, v_period,
         'Monthly referral reward for an active ' ||
           CASE WHEN v_tier = 'pawpass_plus' THEN 'PawPass+' ELSE 'PawPass' END || ' member');
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('awarded', false, 'reason', 'already_awarded_this_month');
    END;

    PERFORM public.credit_pet_pro_referral_usd(r.referrer_id, v_cents);
    UPDATE public.referrals SET referrer_bonus_awarded = true WHERE id = r.id;

    RETURN jsonb_build_object('awarded', true, 'amount_cents', v_cents);
  END IF;

  -- Pet Parent referrer: one-time PawBucks reward
  v_pb := CASE WHEN v_tier = 'pawpass_plus' THEN 20000 ELSE 10000 END;

  IF EXISTS (
    SELECT 1 FROM public.referral_rewards
    WHERE referral_id = r.id
      AND reward_type IN ('parent_refers_pawpass', 'parent_refers_pawpass_plus')
  ) THEN
    RETURN jsonb_build_object('awarded', false, 'reason', 'already_awarded');
  END IF;

  INSERT INTO public.referral_rewards
    (referral_id, beneficiary_id, reward_type, amount_pb, description)
  VALUES
    (r.id, r.referrer_id,
     CASE WHEN v_tier = 'pawpass_plus' THEN 'parent_refers_pawpass_plus' ELSE 'parent_refers_pawpass' END,
     v_pb,
     'Referred member started ' || CASE WHEN v_tier = 'pawpass_plus' THEN 'PawPass+' ELSE 'PawPass' END);

  PERFORM public.credit_referral_pawbucks(r.referrer_id, v_pb, 'Referral reward - membership started');
  UPDATE public.referrals SET referrer_bonus_awarded = true WHERE id = r.id;

  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (r.referrer_id, 'Referral reward earned',
          'Your referral started a paid membership. You earned ' || to_char(v_pb, 'FM999,999') || ' PawBucks.',
          'promotional');

  RETURN jsonb_build_object('awarded', true, 'amount_pb', v_pb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_referral_subscription_reward(uuid, text, timestamptz) TO service_role;

-- ------------------------------------------------------------
-- 3) Pet Pro refers a Pet Pro: $50 once the referred pro processes $1,700 in sales
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_pet_pro_referral_sales_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_owner uuid;
  v_total numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR NEW.merchant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_owner FROM public.merchants WHERE id = NEW.merchant_id;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO r
  FROM public.referrals
  WHERE referee_id = v_owner
    AND referrer_is_pro = true
    AND pro_sales_bonus_awarded = false
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(t.amount), 0) INTO v_total
  FROM public.transactions t
  JOIN public.merchants m ON m.id = t.merchant_id
  WHERE m.user_id = v_owner AND t.status = 'completed';

  UPDATE public.referrals SET pro_sales_total = v_total WHERE id = r.id;

  IF v_total < 1700 THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.referral_rewards
      (referral_id, beneficiary_id, reward_type, amount_cents, description)
    VALUES
      (r.id, r.referrer_id, 'pro_refers_pro_sales_bonus', 5000,
       'Referred Pet Pro processed $1,700 in platform sales');
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  PERFORM public.credit_pet_pro_referral_usd(r.referrer_id, 5000);

  UPDATE public.referrals
  SET pro_sales_bonus_awarded = true, referrer_bonus_awarded = true
  WHERE id = r.id;

  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (r.referrer_id, 'Referral bonus earned',
          'A Pet Pro you referred passed $1,700 in platform sales. You earned a $50 referral bonus.',
          'promotional');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pet_pro_referral_sales_bonus_trigger ON public.transactions;
CREATE TRIGGER pet_pro_referral_sales_bonus_trigger
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.check_pet_pro_referral_sales_bonus();

-- ------------------------------------------------------------
-- 4) Retire the legacy flat $10/$10 payout path
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_referral_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_bonus RECORD;
  v_month2_scheduled_at timestamptz;
BEGIN
  IF NEW.status != 'completed' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF (SELECT COUNT(*) FROM public.transactions WHERE user_id = NEW.user_id AND status = 'completed') > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.amount < 40.00 THEN
    RETURN NEW;
  END IF;

  -- Pet Fund referrer bonus (unchanged)
  SELECT * INTO v_referrer_bonus
  FROM public.pet_fund_referrer_bonuses
  WHERE referee_id = NEW.user_id AND status = 'pending';

  IF FOUND THEN
    SELECT scheduled_at INTO v_month2_scheduled_at
    FROM public.pet_fund_releases
    WHERE user_id = NEW.user_id AND month_number = 2
    LIMIT 1;

    UPDATE public.pet_fund_referrer_bonuses
    SET status = 'locked',
        first_purchase_at = now(),
        release_at = COALESCE(v_month2_scheduled_at, now() + interval '60 days'),
        updated_at = now()
    WHERE id = v_referrer_bonus.id;

    INSERT INTO public.notifications (user_id, title, message, category)
    VALUES (
      v_referrer_bonus.referrer_id,
      'Pet Fund referral bonus earned',
      'Your friend made their first $40+ purchase. Your 10,000 PawBucks release with their 2nd monthly fund.',
      'promotional'
    );
  END IF;

  -- Referral program v2 rewards are handled by
  -- handle_referral_signup_rewards / process_referral_subscription_reward.
  RETURN NEW;
END;
$$;