
-- =============================================
-- Quarter-Million Sign Up Bonus: Pet Fund System
-- =============================================

-- 1. Pet Fund Ledger (one per user)
CREATE TABLE public.pet_fund_ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_amount integer NOT NULL DEFAULT 250000,
  available_balance integer NOT NULL DEFAULT 0,
  escrow_balance integer NOT NULL DEFAULT 0,
  total_released integer NOT NULL DEFAULT 0,
  total_used integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  referred_by uuid,
  device_fingerprint text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_fund_ledgers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pet fund" ON public.pet_fund_ledgers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Superadmins can manage pet fund ledgers" ON public.pet_fund_ledgers
  FOR ALL TO authenticated USING (public.is_superadmin(auth.uid()));

-- 2. Pet Fund Releases (24 rows per user)
CREATE TABLE public.pet_fund_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid NOT NULL REFERENCES public.pet_fund_ledgers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  month_number integer NOT NULL,
  amount integer NOT NULL,
  min_transaction_usd numeric(10,2) NOT NULL DEFAULT 20.00,
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL,
  released_at timestamptz,
  used_at timestamptz,
  used_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ledger_id, month_number)
);

ALTER TABLE public.pet_fund_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fund releases" ON public.pet_fund_releases
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Superadmins can manage pet fund releases" ON public.pet_fund_releases
  FOR ALL TO authenticated USING (public.is_superadmin(auth.uid()));

-- 3. Pet Fund Referrer Bonuses
CREATE TABLE public.pet_fund_referrer_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referee_id uuid NOT NULL,
  amount integer NOT NULL DEFAULT 10000,
  status text NOT NULL DEFAULT 'pending',
  first_purchase_at timestamptz,
  release_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referee_id)
);

ALTER TABLE public.pet_fund_referrer_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrers can view own bonuses" ON public.pet_fund_referrer_bonuses
  FOR SELECT TO authenticated USING (referrer_id = auth.uid());

CREATE POLICY "Superadmins can manage referrer bonuses" ON public.pet_fund_referrer_bonuses
  FOR ALL TO authenticated USING (public.is_superadmin(auth.uid()));

-- 4. Helper: Initialize Pet Fund
CREATE OR REPLACE FUNCTION public.initialize_pet_fund(p_user_id uuid, p_referred_by uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ledger_id uuid;
  v_now timestamptz := now();
BEGIN
  INSERT INTO pet_fund_ledgers (user_id, total_amount, available_balance, escrow_balance, total_released, referred_by)
  VALUES (p_user_id, 250000, 20000, 230000, 20000, p_referred_by)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_ledger_id;

  IF v_ledger_id IS NULL THEN
    SELECT id INTO v_ledger_id FROM pet_fund_ledgers WHERE user_id = p_user_id;
    RETURN v_ledger_id;
  END IF;

  -- Month 0: immediate release (20k PB, $40 min transaction)
  INSERT INTO pet_fund_releases (ledger_id, user_id, month_number, amount, min_transaction_usd, status, scheduled_at, released_at)
  VALUES (v_ledger_id, p_user_id, 0, 20000, 40.00, 'released', v_now, v_now);

  -- Months 1-23: 10k PB each, $20 min transaction, every 30 days
  FOR i IN 1..23 LOOP
    INSERT INTO pet_fund_releases (ledger_id, user_id, month_number, amount, min_transaction_usd, status, scheduled_at)
    VALUES (v_ledger_id, p_user_id, i, 10000, 20.00, 'pending', v_now + (i * INTERVAL '30 days'));
  END LOOP;

  IF p_referred_by IS NOT NULL THEN
    INSERT INTO pet_fund_referrer_bonuses (referrer_id, referee_id, amount, status)
    VALUES (p_referred_by, p_user_id, 10000, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_ledger_id;
END;
$$;

-- 5. Helper: Release pet fund installment atomically
CREATE OR REPLACE FUNCTION public.release_pet_fund_installment(p_release_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_release RECORD;
BEGIN
  SELECT * INTO v_release FROM pet_fund_releases WHERE id = p_release_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE pet_fund_releases SET status = 'released', released_at = now() WHERE id = p_release_id;

  UPDATE pet_fund_ledgers
  SET available_balance = available_balance + v_release.amount,
      escrow_balance = escrow_balance - v_release.amount,
      total_released = total_released + v_release.amount,
      updated_at = now()
  WHERE id = v_release.ledger_id;
END;
$$;

-- 6. Helper: Release referrer bonus atomically
CREATE OR REPLACE FUNCTION public.release_referrer_bonus(p_bonus_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus RECORD;
BEGIN
  SELECT * INTO v_bonus FROM pet_fund_referrer_bonuses WHERE id = p_bonus_id AND status = 'locked' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE pawbucks_wallet SET balance = balance + v_bonus.amount WHERE user_id = v_bonus.referrer_id;

  INSERT INTO pawbucks_activity (user_id, type, amount, description, source, pawbucks_status)
  VALUES (v_bonus.referrer_id, 'credit', v_bonus.amount, 'Referral bonus - friend completed 2nd month!', 'referral', 'available');

  UPDATE pet_fund_referrer_bonuses SET status = 'released', released_at = now(), updated_at = now() WHERE id = p_bonus_id;

  INSERT INTO notifications (user_id, title, message, category)
  VALUES (v_bonus.referrer_id, '🎉 Referral Bonus Released!', 'Your 10,000 PawBucks ($10) referral bonus is now in your wallet!', 'promotional');
END;
$$;

-- 7. Helper: Use pet fund credits at checkout
CREATE OR REPLACE FUNCTION public.use_pet_fund_credit(p_user_id uuid, p_amount integer, p_transaction_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ledger RECORD;
  v_release RECORD;
  v_remaining integer := p_amount;
BEGIN
  SELECT * INTO v_ledger FROM pet_fund_ledgers
  WHERE user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND OR v_ledger.available_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  FOR v_release IN
    SELECT * FROM pet_fund_releases
    WHERE ledger_id = v_ledger.id AND status = 'released' AND used_at IS NULL
    ORDER BY month_number ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    UPDATE pet_fund_releases SET used_at = now(), used_transaction_id = p_transaction_id WHERE id = v_release.id;
    v_remaining := v_remaining - v_release.amount;
  END LOOP;

  UPDATE pet_fund_ledgers
  SET available_balance = available_balance - p_amount,
      total_used = total_used + p_amount,
      updated_at = now()
  WHERE id = v_ledger.id;

  RETURN TRUE;
END;
$$;

-- 8. Update handle_new_user to use Pet Fund system
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_type user_type;
  _normalized_email text;
  _is_abusive boolean;
  _abuse_reason text;
  _phone text;
  _welcome_credit_enabled boolean;
  _referred_by uuid;
  _referral_code text;
BEGIN
  _user_type := COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'pet_owner');
  _normalized_email := normalize_email(NEW.email);
  _phone := NEW.raw_user_meta_data->>'phone';
  _referral_code := NEW.raw_user_meta_data->>'referral_code';

  INSERT INTO public.profiles (id, email, full_name, user_type, normalized_email)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _user_type,
    _normalized_email
  );

  IF _user_type = 'pet_owner' THEN
    SELECT COALESCE((value::text)::boolean, true) INTO _welcome_credit_enabled
    FROM public.platform_settings
    WHERE key = 'welcome_credit_enabled';

    IF _welcome_credit_enabled IS NULL THEN
      _welcome_credit_enabled := true;
    END IF;

    IF NOT _welcome_credit_enabled THEN
      INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
      VALUES ('credit_skipped_program_paused', NEW.id, jsonb_build_object(
        'email', NEW.email,
        'reason', 'pet_fund_program_paused'
      ));
    ELSE
      SELECT ca.is_abusive, ca.reason INTO _is_abusive, _abuse_reason
      FROM public.check_welcome_credit_abuse(NEW.email, _phone) ca;

      IF COALESCE(_is_abusive, FALSE) THEN
        INSERT INTO public.welcome_credit_abuse_signals (user_id, signal_type, signal_data, severity)
        VALUES (NEW.id, 'signup_abuse_blocked', jsonb_build_object(
          'reason', _abuse_reason,
          'email', NEW.email,
          'normalized_email', _normalized_email,
          'phone', _phone
        ), 'critical');

        INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
        VALUES ('credit_blocked', NEW.id, jsonb_build_object(
          'reason', _abuse_reason,
          'email', NEW.email,
          'normalized_email', _normalized_email
        ));
      ELSE
        -- Look up referrer if referral code provided
        IF _referral_code IS NOT NULL AND _referral_code != '' THEN
          SELECT id INTO _referred_by FROM public.profiles WHERE referral_code = _referral_code;
        END IF;

        -- Initialize the Pet Fund (250k PB over 24 months)
        PERFORM public.initialize_pet_fund(NEW.id, _referred_by);

        INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
        VALUES ('pet_fund_created', NEW.id, jsonb_build_object(
          'total_amount', 250000,
          'immediate_release', 20000,
          'escrow', 230000,
          'months', 24,
          'referred_by', _referred_by
        ));

        INSERT INTO public.notifications (user_id, title, message, category)
        VALUES (
          NEW.id,
          '🎉 $250 Quarter-Million Pet Fund Activated!',
          'Your $250 Pet Fund is live! $20 is available now, plus $10 unlocks every month for 23 months. Start shopping!',
          'promotional'
        );

        -- Create referral record if referred
        IF _referred_by IS NOT NULL THEN
          INSERT INTO public.referrals (referrer_id, referee_id)
          VALUES (_referred_by, NEW.id)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user trigger error for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  RAISE;
END;
$$;

-- 9. Update referral bonus trigger for pet fund system
CREATE OR REPLACE FUNCTION public.award_referral_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referrer_bonus RECORD;
  v_month2_scheduled_at timestamptz;
  referral_record RECORD;
BEGIN
  IF NEW.status != 'completed' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only first completed transaction
  IF (SELECT COUNT(*) FROM public.transactions WHERE user_id = NEW.user_id AND status = 'completed') > 1 THEN
    RETURN NEW;
  END IF;

  -- Minimum $40 for first purchase
  IF NEW.amount < 40.00 THEN
    RETURN NEW;
  END IF;

  -- Handle pet fund referrer bonus
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
      '🎉 Referral Bonus Earned!',
      'Your friend made their first $40+ purchase! You''ll receive 10,000 PawBucks ($10) when their 2nd monthly fund releases.',
      'promotional'
    );
  END IF;

  -- Handle legacy referral records
  SELECT * INTO referral_record
  FROM public.referrals
  WHERE referee_id = NEW.user_id
    AND (referrer_bonus_awarded = false OR referrer_bonus_awarded IS NULL);

  IF FOUND THEN
    UPDATE public.referrals
    SET referrer_bonus_awarded = true, referee_bonus_awarded = true
    WHERE id = referral_record.id;
  END IF;

  RETURN NEW;
END;
$$;
