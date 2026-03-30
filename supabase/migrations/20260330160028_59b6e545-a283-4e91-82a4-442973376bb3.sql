
-- Drop old functions with different signatures
DROP FUNCTION IF EXISTS public.get_active_promotion(uuid);
DROP FUNCTION IF EXISTS public.claim_pet_fund_spot(uuid);

-- 1. Add series_tier column to pet_fund_ledgers
ALTER TABLE public.pet_fund_ledgers ADD COLUMN IF NOT EXISTS series_tier text NOT NULL DEFAULT 'series_a';
ALTER TABLE public.pet_fund_ledgers ADD COLUMN IF NOT EXISTS cluster_id uuid;

-- 2. Add expires_at column to pet_fund_releases (for monthly expiration)
ALTER TABLE public.pet_fund_releases ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 3. Update launch_clusters to track cumulative spots for tiered system
ALTER TABLE public.launch_clusters ADD COLUMN IF NOT EXISTS series_a_max integer NOT NULL DEFAULT 500;
ALTER TABLE public.launch_clusters ADD COLUMN IF NOT EXISTS series_a_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.launch_clusters ADD COLUMN IF NOT EXISTS series_b_max integer NOT NULL DEFAULT 1000;
ALTER TABLE public.launch_clusters ADD COLUMN IF NOT EXISTS series_b_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.launch_clusters ADD COLUMN IF NOT EXISTS series_c_max integer NOT NULL DEFAULT 2500;
ALTER TABLE public.launch_clusters ADD COLUMN IF NOT EXISTS series_c_used integer NOT NULL DEFAULT 0;

-- 4. Function to determine which tier a new user gets
CREATE OR REPLACE FUNCTION public.get_active_promotion(p_cluster_id uuid DEFAULT NULL)
RETURNS TABLE(promotion_type text, cluster_id uuid, cluster_name text, spots_remaining integer, series_tier text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cluster RECORD;
BEGIN
  IF p_cluster_id IS NULL THEN
    SELECT * INTO v_cluster FROM launch_clusters WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  ELSE
    SELECT * INTO v_cluster FROM launch_clusters WHERE id = p_cluster_id AND is_active = true;
  END IF;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'pet_fund'::text, NULL::uuid, NULL::text, NULL::integer, 'standard'::text;
    RETURN;
  END IF;

  IF v_cluster.series_a_used < v_cluster.series_a_max THEN
    RETURN QUERY SELECT 'pet_fund'::text, v_cluster.id, v_cluster.name, (v_cluster.series_a_max - v_cluster.series_a_used)::integer, 'series_a'::text;
  ELSIF v_cluster.series_b_used < v_cluster.series_b_max THEN
    RETURN QUERY SELECT 'pet_fund'::text, v_cluster.id, v_cluster.name, (v_cluster.series_b_max - v_cluster.series_b_used)::integer, 'series_b'::text;
  ELSIF v_cluster.series_c_used < v_cluster.series_c_max THEN
    RETURN QUERY SELECT 'pet_fund'::text, v_cluster.id, v_cluster.name, (v_cluster.series_c_max - v_cluster.series_c_used)::integer, 'series_c'::text;
  ELSE
    RETURN QUERY SELECT 'pet_fund'::text, v_cluster.id, v_cluster.name, NULL::integer, 'standard'::text;
  END IF;
END;
$$;

-- 5. Function to claim a spot in the appropriate tier
CREATE OR REPLACE FUNCTION public.claim_pet_fund_spot(p_cluster_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cluster RECORD;
BEGIN
  SELECT * INTO v_cluster FROM launch_clusters WHERE id = p_cluster_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RETURN 'standard'; END IF;

  IF v_cluster.series_a_used < v_cluster.series_a_max THEN
    UPDATE launch_clusters SET series_a_used = series_a_used + 1, updated_at = now() WHERE id = p_cluster_id;
    RETURN 'series_a';
  ELSIF v_cluster.series_b_used < v_cluster.series_b_max THEN
    UPDATE launch_clusters SET series_b_used = series_b_used + 1, updated_at = now() WHERE id = p_cluster_id;
    RETURN 'series_b';
  ELSIF v_cluster.series_c_used < v_cluster.series_c_max THEN
    UPDATE launch_clusters SET series_c_used = series_c_used + 1, updated_at = now() WHERE id = p_cluster_id;
    RETURN 'series_c';
  ELSE
    RETURN 'standard';
  END IF;
END;
$$;

-- 6. Updated initialize_pet_fund with tier support and monthly expiration
CREATE OR REPLACE FUNCTION public.initialize_pet_fund(p_user_id uuid, p_referred_by uuid DEFAULT NULL, p_series_tier text DEFAULT 'series_a', p_cluster_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ledger_id uuid;
  v_now timestamptz := now();
  v_total integer;
  v_upfront integer;
  v_monthly integer;
  v_months integer;
  v_upfront_min numeric(10,2);
  v_monthly_min numeric(10,2);
BEGIN
  CASE p_series_tier
    WHEN 'series_a' THEN
      v_total := 250000; v_upfront := 20000; v_monthly := 10000; v_months := 23;
      v_upfront_min := 40.00; v_monthly_min := 20.00;
    WHEN 'series_b' THEN
      v_total := 150000; v_upfront := 15000; v_monthly := 15000; v_months := 9;
      v_upfront_min := 30.00; v_monthly_min := 30.00;
    WHEN 'series_c' THEN
      v_total := 75000; v_upfront := 15000; v_monthly := 10000; v_months := 6;
      v_upfront_min := 30.00; v_monthly_min := 20.00;
    WHEN 'standard' THEN
      v_total := 50000; v_upfront := 10000; v_monthly := 10000; v_months := 4;
      v_upfront_min := 20.00; v_monthly_min := 20.00;
    ELSE
      v_total := 50000; v_upfront := 10000; v_monthly := 10000; v_months := 4;
      v_upfront_min := 20.00; v_monthly_min := 20.00;
  END CASE;

  INSERT INTO pet_fund_ledgers (user_id, total_amount, available_balance, escrow_balance, total_released, referred_by, series_tier, cluster_id)
  VALUES (p_user_id, v_total, v_upfront, v_total - v_upfront, v_upfront, p_referred_by, p_series_tier, p_cluster_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_ledger_id;

  IF v_ledger_id IS NULL THEN
    SELECT id INTO v_ledger_id FROM pet_fund_ledgers WHERE user_id = p_user_id;
    RETURN v_ledger_id;
  END IF;

  -- Month 0: immediate release with 30-day expiration
  INSERT INTO pet_fund_releases (ledger_id, user_id, month_number, amount, min_transaction_usd, status, scheduled_at, released_at, expires_at)
  VALUES (v_ledger_id, p_user_id, 0, v_upfront, v_upfront_min, 'released', v_now, v_now, v_now + INTERVAL '30 days');

  -- Monthly installments with 30-day expiration windows
  FOR i IN 1..v_months LOOP
    INSERT INTO pet_fund_releases (ledger_id, user_id, month_number, amount, min_transaction_usd, status, scheduled_at, expires_at)
    VALUES (v_ledger_id, p_user_id, i, v_monthly, v_monthly_min, 'pending', v_now + (i * INTERVAL '30 days'), v_now + ((i + 1) * INTERVAL '30 days'));
  END LOOP;

  IF p_referred_by IS NOT NULL THEN
    INSERT INTO pet_fund_referrer_bonuses (referrer_id, referee_id, amount, status)
    VALUES (p_referred_by, p_user_id, 10000, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_ledger_id;
END;
$$;

-- 7. Function to expire unused monthly credits
CREATE OR REPLACE FUNCTION public.expire_unused_pet_fund_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expired_count integer := 0;
  v_release RECORD;
BEGIN
  FOR v_release IN
    SELECT r.id, r.ledger_id, r.user_id, r.amount, r.month_number
    FROM pet_fund_releases r
    WHERE r.status = 'released'
      AND r.used_at IS NULL
      AND r.expires_at IS NOT NULL
      AND r.expires_at <= now()
    FOR UPDATE OF r
  LOOP
    UPDATE pet_fund_releases SET status = 'expired' WHERE id = v_release.id;

    UPDATE pet_fund_ledgers
    SET available_balance = GREATEST(available_balance - v_release.amount, 0),
        updated_at = now()
    WHERE id = v_release.ledger_id;

    INSERT INTO notifications (user_id, title, message, category)
    VALUES (v_release.user_id, '⏰ Pet Fund Credit Expired',
      'Your $' || (v_release.amount / 1000) || ' Month ' || v_release.month_number || ' credit expired unused. Use future credits before they expire!',
      'transactional');

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

-- 8. Update handle_new_user to pass tier info
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
  _promo RECORD;
  _tier text;
  _cluster_id uuid;
  _total_amount integer;
  _upfront integer;
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
        IF _referral_code IS NOT NULL AND _referral_code != '' THEN
          SELECT id INTO _referred_by FROM public.profiles WHERE referral_code = _referral_code;
        END IF;

        -- Determine tier from active cluster
        SELECT * INTO _promo FROM public.get_active_promotion() LIMIT 1;
        _tier := COALESCE(_promo.series_tier, 'standard');
        _cluster_id := _promo.cluster_id;

        -- Claim spot if cluster exists
        IF _cluster_id IS NOT NULL THEN
          _tier := public.claim_pet_fund_spot(_cluster_id);
          IF _tier IS NULL THEN _tier := 'standard'; END IF;
        END IF;

        PERFORM public.initialize_pet_fund(NEW.id, _referred_by, _tier, _cluster_id);

        CASE _tier
          WHEN 'series_a' THEN _total_amount := 250000; _upfront := 20000;
          WHEN 'series_b' THEN _total_amount := 150000; _upfront := 15000;
          WHEN 'series_c' THEN _total_amount := 75000; _upfront := 15000;
          ELSE _total_amount := 50000; _upfront := 10000;
        END CASE;

        INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
        VALUES ('pet_fund_created', NEW.id, jsonb_build_object(
          'total_amount', _total_amount,
          'immediate_release', _upfront,
          'series_tier', _tier,
          'cluster_id', _cluster_id,
          'referred_by', _referred_by
        ));

        INSERT INTO public.notifications (user_id, title, message, category)
        VALUES (
          NEW.id,
          '🎉 Welcome Credit Activated!',
          'Your $' || (_total_amount / 1000) || ' Pet Fund is live! $' || (_upfront / 1000) || ' is available now. Use it before it expires!',
          'promotional'
        );

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

-- 9. Migrate existing launch_clusters data: copy pet_fund_spots_used into series_a_used
UPDATE public.launch_clusters SET series_a_used = pet_fund_spots_used WHERE pet_fund_spots_used > 0;
