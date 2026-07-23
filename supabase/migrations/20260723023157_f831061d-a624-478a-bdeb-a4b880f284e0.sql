-- Fix false PawBucks expiration notifications.
-- Prior version summed gross "earn" rows regardless of subsequent spending,
-- so users were reminded about PawBucks they had already spent.
-- Reconcile against the wallet balance using FIFO (oldest expiry spent first);
-- only the tail of latest-expiring batches represents truly unspent PawBucks.

CREATE OR REPLACE FUNCTION public.send_pawbucks_expiry_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reminder_count integer := 0;
  v_user_id uuid;
  v_wallet_balance integer;
  v_reminder_days integer[] := ARRAY[14, 7, 1];
  v_day integer;
  v_title text;
  v_message text;
  v_batch RECORD;
  v_remaining integer;
  v_unspent_by_batch jsonb;
  v_window_amount integer;
  v_window_ids uuid[];
  v_usd numeric;
BEGIN
  -- Iterate every user with any available earned PawBucks that have an expiry
  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM pawbucks_activity
    WHERE type = 'earn'
      AND pawbucks_status = 'available'
      AND expires_at IS NOT NULL
      AND expires_at > now()
  LOOP
    SELECT COALESCE(balance, 0) INTO v_wallet_balance
    FROM pawbucks_wallet WHERE user_id = v_user_id;

    IF v_wallet_balance IS NULL OR v_wallet_balance <= 0 THEN
      CONTINUE;
    END IF;

    -- FIFO reconciliation: walk earn batches from LATEST expiry to soonest,
    -- accumulating up to the wallet balance. Whatever we cover is the
    -- currently-unspent portion of each batch.
    v_remaining := v_wallet_balance;
    v_unspent_by_batch := '{}'::jsonb;

    FOR v_batch IN
      SELECT id, amount, expires_at
      FROM pawbucks_activity
      WHERE user_id = v_user_id
        AND type = 'earn'
        AND pawbucks_status = 'available'
        AND expires_at IS NOT NULL
        AND expires_at > now()
      ORDER BY expires_at DESC, created_at DESC
    LOOP
      EXIT WHEN v_remaining <= 0;
      DECLARE
        v_take integer := LEAST(v_remaining, COALESCE(v_batch.amount, 0));
      BEGIN
        IF v_take > 0 THEN
          v_unspent_by_batch := v_unspent_by_batch || jsonb_build_object(
            v_batch.id::text,
            jsonb_build_object('amount', v_take, 'expires_at', v_batch.expires_at)
          );
          v_remaining := v_remaining - v_take;
        END IF;
      END;
    END LOOP;

    -- For each reminder window, only notify if the unspent portion whose
    -- expiry falls inside that window is > 0 AND we haven't already sent it.
    FOREACH v_day IN ARRAY v_reminder_days
    LOOP
      v_window_amount := 0;
      v_window_ids := ARRAY[]::uuid[];

      DECLARE
        k text;
        v jsonb;
        v_exp timestamptz;
        v_amt integer;
        v_already integer[];
      BEGIN
        FOR k, v IN SELECT * FROM jsonb_each(v_unspent_by_batch)
        LOOP
          v_exp := (v->>'expires_at')::timestamptz;
          v_amt := (v->>'amount')::integer;

          IF v_exp <= now() + (v_day || ' days')::interval AND v_amt > 0 THEN
            SELECT expiry_reminder_sent_days INTO v_already
              FROM pawbucks_activity WHERE id = k::uuid;
            IF v_already IS NULL OR NOT (v_already @> ARRAY[v_day]) THEN
              v_window_amount := v_window_amount + v_amt;
              v_window_ids := array_append(v_window_ids, k::uuid);
            END IF;
          END IF;
        END LOOP;
      END;

      IF v_window_amount <= 0 OR array_length(v_window_ids, 1) IS NULL THEN
        CONTINUE;
      END IF;

      v_usd := ROUND((v_window_amount::numeric) / 1000.0, 2);

      IF v_day = 1 THEN
        v_title := '🚨 PawBucks Expiring Tomorrow!';
        v_message := v_window_amount || ' PawBucks (~$' || v_usd
          || ') expire tomorrow. Use them before they''re gone!';
      ELSIF v_day = 7 THEN
        v_title := '⚠️ PawBucks Expiring in 7 Days';
        v_message := v_window_amount || ' PawBucks (~$' || v_usd
          || ') expire in 7 days. Visit a partner merchant to use them!';
      ELSE
        v_title := '📢 PawBucks Expiring Soon';
        v_message := v_window_amount || ' PawBucks (~$' || v_usd
          || ') expire in 14 days. Plan a visit to your favorite pet store!';
      END IF;

      INSERT INTO notifications (user_id, title, message, category)
      VALUES (v_user_id, v_title, v_message, 'transactional');

      UPDATE pawbucks_activity
      SET expiry_reminder_sent_days =
        array_append(COALESCE(expiry_reminder_sent_days, '{}'), v_day)
      WHERE id = ANY(v_window_ids);

      v_reminder_count := v_reminder_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_reminder_count;
END;
$function$;