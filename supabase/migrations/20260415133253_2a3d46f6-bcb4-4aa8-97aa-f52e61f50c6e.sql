
-- Fix #1: get_monthly_non_partner_pawbucks — use user's timezone for month boundary
CREATE OR REPLACE FUNCTION public.get_monthly_non_partner_pawbucks(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM pawbucks_activity
  WHERE user_id = p_user_id
    AND source = 'non-partner'
    AND type = 'credit'
    AND date_trunc('month', created_at AT TIME ZONE COALESCE(
      (SELECT timezone FROM profiles WHERE id = p_user_id),
      'America/New_York'
    )) = date_trunc('month', now() AT TIME ZONE COALESCE(
      (SELECT timezone FROM profiles WHERE id = p_user_id),
      'America/New_York'
    ))
$$;

-- Fix #6: expire_unused_pet_fund_credits — use user's timezone for expiry check
CREATE OR REPLACE FUNCTION public.expire_unused_pet_fund_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expired_count integer := 0;
  v_release RECORD;
  v_user_tz text;
  v_user_midnight timestamptz;
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
    -- Get user's timezone for notification timing (expiry comparison already correct
    -- since expires_at is stored as UTC-converted from user's local midnight)
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

-- Also update initialize_pet_fund to set expires_at using user's timezone
CREATE OR REPLACE FUNCTION public.initialize_pet_fund(p_user_id uuid, p_referred_by uuid DEFAULT NULL::uuid, p_series_tier text DEFAULT 'series_a'::text, p_cluster_id uuid DEFAULT NULL::uuid)
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
  v_user_tz text;
BEGIN
  -- Get user's timezone
  SELECT COALESCE(timezone, 'America/New_York') INTO v_user_tz
  FROM profiles WHERE id = p_user_id;
  v_user_tz := COALESCE(v_user_tz, 'America/New_York');

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

  -- Upfront release: expires at midnight user-local time, 30 days out
  INSERT INTO pet_fund_releases (ledger_id, user_id, month_number, amount, min_transaction_usd, status, scheduled_at, released_at, expires_at)
  VALUES (v_ledger_id, p_user_id, 0, v_upfront, v_upfront_min, 'released', v_now, v_now,
    ((v_now AT TIME ZONE v_user_tz)::date + INTERVAL '30 days') AT TIME ZONE v_user_tz);

  FOR i IN 1..v_months LOOP
    INSERT INTO pet_fund_releases (ledger_id, user_id, month_number, amount, min_transaction_usd, status, scheduled_at, expires_at)
    VALUES (v_ledger_id, p_user_id, i, v_monthly, v_monthly_min, 'pending',
      ((v_now AT TIME ZONE v_user_tz)::date + (i * INTERVAL '30 days')) AT TIME ZONE v_user_tz,
      ((v_now AT TIME ZONE v_user_tz)::date + ((i + 1) * INTERVAL '30 days')) AT TIME ZONE v_user_tz);
  END LOOP;

  IF p_referred_by IS NOT NULL THEN
    INSERT INTO pet_fund_referrer_bonuses (referrer_id, referee_id, amount, status)
    VALUES (p_referred_by, p_user_id, 10000, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_ledger_id;
END;
$$;
