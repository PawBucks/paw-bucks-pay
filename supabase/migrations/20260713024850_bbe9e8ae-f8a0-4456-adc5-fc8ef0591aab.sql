
-- Fix expire_pawbucks: only expire the UNCONSUMED remainder of each earn row (FIFO).
-- Previously it expired the full earn amount even if it had already been redeemed,
-- causing double-deductions when users spent PawBucks on invoices/subscriptions
-- and the expiration cron fired 60 days after the original earn.

CREATE OR REPLACE FUNCTION public.expire_pawbucks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expired_count integer := 0;
  v_record RECORD;
  v_total_earned bigint;
  v_total_redeemed bigint;
  v_earned_before bigint;
  v_consumed_of_this_row bigint;
  v_remaining bigint;
BEGIN
  FOR v_record IN
    SELECT id, user_id, amount, created_at
    FROM pawbucks_activity
    WHERE type = 'earn'
      AND pawbucks_status = 'available'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    ORDER BY created_at
    FOR UPDATE
  LOOP
    -- FIFO consumption: compute how much of this specific earn row has been
    -- consumed by prior redemptions (including expirations already recorded).
    SELECT COALESCE(SUM(amount), 0) INTO v_total_redeemed
    FROM pawbucks_activity
    WHERE user_id = v_record.user_id
      AND type = 'redeem'
      AND pawbucks_status IN ('available','used');

    SELECT COALESCE(SUM(amount), 0) INTO v_earned_before
    FROM pawbucks_activity
    WHERE user_id = v_record.user_id
      AND type = 'earn'
      AND pawbucks_status IN ('available','used')
      AND created_at < v_record.created_at;

    -- Amount of THIS row already consumed = redemptions minus earnings that came before it, clamped to [0, amount]
    v_consumed_of_this_row := GREATEST(0, LEAST(v_record.amount, v_total_redeemed - v_earned_before));
    v_remaining := v_record.amount - v_consumed_of_this_row;

    -- Mark the earn row as expired regardless (it's past its date)
    UPDATE pawbucks_activity
    SET pawbucks_status = 'expired'
    WHERE id = v_record.id;

    -- Only insert an expiration redeem row for the UNCONSUMED remainder
    IF v_remaining > 0 THEN
      INSERT INTO pawbucks_activity (user_id, amount, type, source, description, pawbucks_status)
      VALUES (
        v_record.user_id,
        v_remaining,
        'redeem',
        'expiration',
        v_remaining || ' PawBucks expired after 60 days',
        'available'
      );

      INSERT INTO notifications (user_id, title, message, category)
      VALUES (
        v_record.user_id,
        'PawBucks Expired',
        v_remaining || ' PawBucks have expired. Earn and spend PawBucks within 60 days to maximize your rewards!',
        'transactional'
      );

      v_expired_count := v_expired_count + 1;
    END IF;
  END LOOP;

  RETURN v_expired_count;
END;
$function$;

-- ============================================================
-- HISTORICAL REVERSAL: undo bad expirations from the old logic
-- ============================================================
-- 1. Delete every expiration-generated redeem row (they were computed with the buggy logic).
DELETE FROM pawbucks_activity
WHERE type = 'redeem' AND source = 'expiration';

-- 2. Reset earn rows that were marked 'expired' back to 'available' so the
--    corrected function can re-evaluate them fairly.
UPDATE pawbucks_activity
SET pawbucks_status = 'available'
WHERE type = 'earn' AND pawbucks_status = 'expired';

-- 3. Re-run the corrected expiration for anything genuinely past its date with no consumption.
SELECT public.expire_pawbucks();

-- 4. The pawbucks_activity_sync_wallet trigger recomputes each affected wallet.balance
--    automatically on the DELETE/UPDATE above, so no manual wallet write is needed.
--    Force a full recompute for safety in case any users had zero activity churn.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM pawbucks_activity LOOP
    PERFORM public.recompute_pawbucks_wallet(r.user_id);
  END LOOP;
END $$;
