
-- Update trigger to set expires_at at midnight ET on the 60th day
CREATE OR REPLACE FUNCTION public.set_pawbucks_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'credit' AND NEW.expires_at IS NULL THEN
    IF NEW.source NOT IN ('pet_fund', 'welcome_credit', 'branded', 'campaign', 'referral_bonus') THEN
      -- Set expiration to midnight ET on the 60th day
      NEW.expires_at := (
        (COALESCE(NEW.created_at, now()) AT TIME ZONE 'America/New_York')::date 
        + INTERVAL '60 days'
      ) AT TIME ZONE 'America/New_York';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Update expire function to use ET midnight comparison
CREATE OR REPLACE FUNCTION public.expire_pawbucks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expired_count integer := 0;
  v_record RECORD;
  v_now_et timestamp;
BEGIN
  -- Get current time in Eastern
  v_now_et := now() AT TIME ZONE 'America/New_York';

  FOR v_record IN
    SELECT id, user_id, amount
    FROM pawbucks_activity
    WHERE type = 'credit'
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
      v_record.amount,
      'debit',
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
$$;
