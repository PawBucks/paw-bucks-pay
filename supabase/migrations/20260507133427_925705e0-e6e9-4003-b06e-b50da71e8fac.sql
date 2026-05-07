CREATE OR REPLACE FUNCTION public.release_pet_fund_installment(p_release_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_release RECORD;
  v_user_tz text;
  v_release_at timestamptz := now();
  v_new_expires_at timestamptz;
BEGIN
  SELECT * INTO v_release FROM pet_fund_releases WHERE id = p_release_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  -- Re-read user's CURRENT timezone (handles tz changes since fund initialization)
  SELECT COALESCE(timezone, 'America/New_York') INTO v_user_tz
  FROM profiles WHERE id = v_release.user_id;
  v_user_tz := COALESCE(v_user_tz, 'America/New_York');

  -- Anchor expiry to ACTUAL release time at user-local midnight + 30 days.
  -- This guarantees a full 30-day usable window even if the cron runs late.
  v_new_expires_at := ((v_release_at AT TIME ZONE v_user_tz)::date + INTERVAL '30 days')
                      AT TIME ZONE v_user_tz;

  UPDATE pet_fund_releases
  SET status = 'released',
      released_at = v_release_at,
      expires_at = v_new_expires_at
  WHERE id = p_release_id;

  UPDATE pet_fund_ledgers
  SET available_balance = available_balance + v_release.amount,
      escrow_balance = escrow_balance - v_release.amount,
      total_released = total_released + v_release.amount,
      updated_at = now()
  WHERE id = v_release.ledger_id;
END;
$function$;