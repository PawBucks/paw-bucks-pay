-- 1) Allow 'expired' status (needed by expire_pawbucks)
ALTER TABLE public.pawbucks_activity DROP CONSTRAINT IF EXISTS pawbucks_activity_pawbucks_status_check;
ALTER TABLE public.pawbucks_activity ADD CONSTRAINT pawbucks_activity_pawbucks_status_check
  CHECK (pawbucks_status = ANY (ARRAY['pending'::text, 'available'::text, 'expired'::text]));

-- 2) Fix expire_pawbucks: 'credit' -> 'earn'
CREATE OR REPLACE FUNCTION public.expire_pawbucks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expired_count integer := 0;
  v_record RECORD;
BEGIN
  FOR v_record IN
    SELECT id, user_id, amount
    FROM pawbucks_activity
    WHERE type = 'earn'
      AND pawbucks_status = 'available'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    FOR UPDATE
  LOOP
    UPDATE pawbucks_activity 
    SET pawbucks_status = 'expired'
    WHERE id = v_record.id;

    UPDATE pawbucks_wallet
    SET balance = GREATEST(balance - v_record.amount, 0),
        last_updated = now()
    WHERE user_id = v_record.user_id;

    INSERT INTO pawbucks_activity (user_id, amount, type, source, description, pawbucks_status)
    VALUES (
      v_record.user_id,
      -v_record.amount,
      'redeem',
      'expiration',
      'PawBucks expired after 60 days',
      'available'
    );

    INSERT INTO notifications (user_id, title, message, category)
    VALUES (
      v_record.user_id,
      '⏰ PawBucks Expired',
      v_record.amount || ' PawBucks have expired. Earn and spend PawBucks within 60 days to maximize your rewards!',
      'transactional'
    );

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$function$;

-- 3) Fix set_pawbucks_expiration trigger: 'credit' -> 'earn'
CREATE OR REPLACE FUNCTION public.set_pawbucks_expiration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tz text;
BEGIN
  IF NEW.type = 'earn' AND NEW.expires_at IS NULL THEN
    IF NEW.source NOT IN ('pet_fund', 'welcome_credit', 'branded', 'campaign', 'referral_bonus') THEN
      SELECT COALESCE(timezone, 'America/New_York') INTO v_tz
      FROM profiles WHERE id = NEW.user_id;
      
      v_tz := COALESCE(v_tz, 'America/New_York');
      
      NEW.expires_at := (
        (COALESCE(NEW.created_at, now()) AT TIME ZONE v_tz)::date 
        + INTERVAL '60 days'
      ) AT TIME ZONE v_tz;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) Fix send_pawbucks_expiry_reminders: 'credit' -> 'earn'
CREATE OR REPLACE FUNCTION public.send_pawbucks_expiry_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reminder_count integer := 0;
  v_record RECORD;
  v_reminder_days integer[] := ARRAY[14, 7, 1];
  v_day integer;
  v_title text;
  v_message text;
BEGIN
  FOREACH v_day IN ARRAY v_reminder_days
  LOOP
    FOR v_record IN
      SELECT 
        user_id,
        SUM(amount) as total_amount,
        MIN(expires_at) as earliest_expiry,
        array_agg(id) as activity_ids
      FROM pawbucks_activity
      WHERE type = 'earn'
        AND pawbucks_status = 'available'
        AND expires_at IS NOT NULL
        AND expires_at > now()
        AND expires_at <= now() + (v_day || ' days')::interval
        AND NOT (expiry_reminder_sent_days @> ARRAY[v_day])
      GROUP BY user_id
    LOOP
      IF v_day = 1 THEN
        v_title := '🚨 PawBucks Expiring Tomorrow!';
        v_message := v_record.total_amount || ' PawBucks will expire tomorrow! Use them now before they''re gone.';
      ELSIF v_day = 7 THEN
        v_title := '⚠️ PawBucks Expiring in 7 Days';
        v_message := v_record.total_amount || ' PawBucks will expire in 7 days. Visit a partner merchant to use them!';
      ELSE
        v_title := '📢 PawBucks Expiring Soon';
        v_message := v_record.total_amount || ' PawBucks will expire in 14 days. Plan a visit to your favorite pet store!';
      END IF;

      INSERT INTO notifications (user_id, title, message, category)
      VALUES (v_record.user_id, v_title, v_message, 'transactional');

      UPDATE pawbucks_activity
      SET expiry_reminder_sent_days = array_append(COALESCE(expiry_reminder_sent_days, '{}'), v_day)
      WHERE id = ANY(v_record.activity_ids);

      v_reminder_count := v_reminder_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_reminder_count;
END;
$function$;

-- 5) Fix get_locked_pawbucks: 'credit' -> 'earn'
CREATE OR REPLACE FUNCTION public.get_locked_pawbucks(p_user_id uuid)
 RETURNS TABLE(total_locked integer, items json)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH locked_items AS (
    SELECT
      pa.id,
      pa.amount,
      pa.description,
      pa.created_at,
      pa.slice_id,
      COALESCE(isl.recovery_status, 'pending') as slice_status
    FROM pawbucks_activity pa
    LEFT JOIN invoice_slices isl ON pa.slice_id = isl.id
    WHERE pa.user_id = p_user_id
      AND pa.pawbucks_status = 'pending'
      AND pa.type = 'earn'
    ORDER BY pa.created_at DESC
  )
  SELECT
    COALESCE(SUM(amount), 0)::integer as total_locked,
    COALESCE(json_agg(json_build_object(
      'id', id,
      'amount', amount,
      'description', description,
      'created_at', created_at,
      'slice_id', slice_id,
      'slice_status', slice_status
    )), '[]'::json) as items
  FROM locked_items;
$function$;

-- 6) Fix get_monthly_non_partner_pawbucks: 'credit' -> 'earn'
CREATE OR REPLACE FUNCTION public.get_monthly_non_partner_pawbucks(p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM pawbucks_activity
  WHERE user_id = p_user_id
    AND source = 'non-partner'
    AND type = 'earn'
    AND date_trunc('month', created_at AT TIME ZONE COALESCE(
      (SELECT timezone FROM profiles WHERE id = p_user_id),
      'America/New_York'
    )) = date_trunc('month', now() AT TIME ZONE COALESCE(
      (SELECT timezone FROM profiles WHERE id = p_user_id),
      'America/New_York'
    ))
$function$;

-- 7) Fix get_underwriting_signals: 'credit'/'debit' -> 'earn'/'redeem'
CREATE OR REPLACE FUNCTION public.get_underwriting_signals(p_merchant_id uuid)
 RETURNS TABLE(tx_frequency_30d numeric, tx_frequency_90d numeric, avg_days_between_tx numeric, redemption_velocity_avg_hours numeric, redemption_rate_pct numeric, customer_repeat_rate_pct numeric, repeat_customers bigint, one_time_customers bigint, total_unique_customers bigint, avg_review_score numeric, review_count bigint, five_star_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx_30d bigint;
  v_tx_90d bigint;
  v_avg_gap numeric;
  v_redemption_velocity numeric;
  v_redemption_rate numeric;
  v_repeat bigint;
  v_one_time bigint;
  v_total_cust bigint;
  v_repeat_rate numeric;
  v_avg_review numeric;
  v_review_count bigint;
  v_five_star_pct numeric;
BEGIN
  SELECT COUNT(*) INTO v_tx_30d
  FROM transactions
  WHERE merchant_id = p_merchant_id AND status = 'completed'
    AND created_at >= now() - interval '30 days';

  SELECT COUNT(*) INTO v_tx_90d
  FROM transactions
  WHERE merchant_id = p_merchant_id AND status = 'completed'
    AND created_at >= now() - interval '90 days';

  SELECT AVG(gap_days) INTO v_avg_gap
  FROM (
    SELECT EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) / 86400.0 AS gap_days
    FROM transactions
    WHERE merchant_id = p_merchant_id AND status = 'completed'
  ) gaps
  WHERE gap_days IS NOT NULL;

  SELECT AVG(EXTRACT(EPOCH FROM (d.created_at - c.created_at)) / 3600.0) INTO v_redemption_velocity
  FROM pawbucks_activity c
  JOIN pawbucks_activity d ON d.user_id = c.user_id AND d.type = 'redeem' AND d.created_at > c.created_at
  JOIN transactions t ON t.user_id = c.user_id AND t.merchant_id = p_merchant_id AND t.status = 'completed'
  WHERE c.type = 'earn'
    AND c.source = 'transaction'
  LIMIT 1000;

  WITH merchant_earners AS (
    SELECT DISTINCT user_id FROM transactions WHERE merchant_id = p_merchant_id AND status = 'completed' AND user_id IS NOT NULL
  ),
  earned AS (
    SELECT COALESCE(SUM(pa.amount), 0) as total
    FROM pawbucks_activity pa
    JOIN merchant_earners me ON me.user_id = pa.user_id
    WHERE pa.type = 'earn'
  ),
  spent AS (
    SELECT COALESCE(SUM(ABS(pa.amount)), 0) as total
    FROM pawbucks_activity pa
    JOIN merchant_earners me ON me.user_id = pa.user_id
    WHERE pa.type = 'redeem'
  )
  SELECT CASE WHEN e.total > 0 THEN ROUND((s.total / e.total) * 100, 1) ELSE 0 END
  INTO v_redemption_rate
  FROM earned e, spent s;

  WITH customer_tx_counts AS (
    SELECT user_id, COUNT(*) as tx_count
    FROM transactions
    WHERE merchant_id = p_merchant_id AND status = 'completed' AND user_id IS NOT NULL
    GROUP BY user_id
  )
  SELECT
    COUNT(*) FILTER (WHERE tx_count > 1),
    COUNT(*) FILTER (WHERE tx_count = 1),
    COUNT(*)
  INTO v_repeat, v_one_time, v_total_cust
  FROM customer_tx_counts;

  v_repeat_rate := CASE WHEN v_total_cust > 0 THEN ROUND((v_repeat::numeric / v_total_cust) * 100, 1) ELSE 0 END;

  SELECT
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE rating = 5))::numeric / COUNT(*) * 100, 1) ELSE 0 END
  INTO v_avg_review, v_review_count, v_five_star_pct
  FROM merchant_reviews
  WHERE merchant_id = p_merchant_id;

  RETURN QUERY SELECT
    v_tx_30d::numeric,
    v_tx_90d::numeric,
    COALESCE(v_avg_gap, 0)::numeric,
    COALESCE(v_redemption_velocity, 0)::numeric,
    COALESCE(v_redemption_rate, 0)::numeric,
    v_repeat_rate,
    v_repeat,
    v_one_time,
    v_total_cust,
    COALESCE(v_avg_review, 0)::numeric,
    v_review_count,
    v_five_star_pct;
END;
$function$;

-- 8) Make get_pawbucks_breakdown explicitly type-aware to be robust against sign anomalies
CREATE OR REPLACE FUNCTION public.get_pawbucks_breakdown(p_user_id uuid)
 RETURNS TABLE(available_balance integer, pending_balance integer, total_balance integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH balances AS (
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN (pawbucks_status = 'available' OR pawbucks_status IS NULL)
          THEN CASE WHEN type = 'earn' THEN ABS(amount) WHEN type = 'redeem' THEN -ABS(amount) ELSE 0 END
          ELSE 0 
        END
      ), 0)::integer as available,
      COALESCE(SUM(
        CASE 
          WHEN pawbucks_status = 'pending' AND type = 'earn'
          THEN ABS(amount)
          ELSE 0 
        END
      ), 0)::integer as pending
    FROM pawbucks_activity
    WHERE user_id = p_user_id
      AND pawbucks_status != 'expired'
  )
  SELECT 
    available as available_balance,
    pending as pending_balance,
    (available + pending) as total_balance
  FROM balances;
$function$;