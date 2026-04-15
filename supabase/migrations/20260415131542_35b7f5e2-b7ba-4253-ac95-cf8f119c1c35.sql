
-- 1. Add expires_at column to pawbucks_activity
ALTER TABLE public.pawbucks_activity
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Add expired status tracking
ALTER TABLE public.pawbucks_activity
ADD COLUMN IF NOT EXISTS expiry_reminder_sent_days INTEGER[] DEFAULT '{}';

-- 3. Create index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_pawbucks_activity_expires_at 
ON public.pawbucks_activity (expires_at) 
WHERE expires_at IS NOT NULL AND type = 'credit' AND pawbucks_status = 'available';

-- 4. Create trigger to auto-set expires_at on new non-promotional credits
CREATE OR REPLACE FUNCTION public.set_pawbucks_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only set expiration for credit entries (not debits)
  IF NEW.type = 'credit' AND NEW.expires_at IS NULL THEN
    -- Exclude promotional sources: pet_fund, welcome_credit, branded/campaign
    IF NEW.source NOT IN ('pet_fund', 'welcome_credit', 'branded', 'campaign', 'referral_bonus') THEN
      NEW.expires_at := COALESCE(NEW.created_at, now()) + INTERVAL '60 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_pawbucks_expiration
BEFORE INSERT ON public.pawbucks_activity
FOR EACH ROW
EXECUTE FUNCTION public.set_pawbucks_expiration();

-- 5. Function to expire PawBucks and deduct from wallet
CREATE OR REPLACE FUNCTION public.expire_pawbucks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expired_count integer := 0;
  v_record RECORD;
BEGIN
  FOR v_record IN
    SELECT id, user_id, amount
    FROM pawbucks_activity
    WHERE type = 'credit'
      AND pawbucks_status = 'available'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    FOR UPDATE
  LOOP
    -- Mark as expired
    UPDATE pawbucks_activity 
    SET pawbucks_status = 'expired'
    WHERE id = v_record.id;

    -- Deduct from wallet (don't go below zero)
    UPDATE pawbucks_wallet
    SET balance = GREATEST(balance - v_record.amount, 0),
        last_updated = now()
    WHERE user_id = v_record.user_id;

    -- Log the expiration as a debit entry for audit trail
    INSERT INTO pawbucks_activity (user_id, amount, type, source, description, pawbucks_status)
    VALUES (
      v_record.user_id,
      v_record.amount,
      'debit',
      'expiration',
      'PawBucks expired after 60 days',
      'available'
    );

    -- Send expiration notification
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

-- 6. Function to send expiration reminder notifications
CREATE OR REPLACE FUNCTION public.send_pawbucks_expiry_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reminder_count integer := 0;
  v_record RECORD;
  v_days_until_expiry integer;
  v_reminder_days integer[] := ARRAY[14, 7, 1];
  v_day integer;
  v_total_expiring integer;
  v_title text;
  v_message text;
BEGIN
  -- For each reminder threshold (14, 7, 1 days)
  FOREACH v_day IN ARRAY v_reminder_days
  LOOP
    -- Find users with PawBucks expiring within this window who haven't been reminded yet
    FOR v_record IN
      SELECT 
        user_id,
        SUM(amount) as total_amount,
        MIN(expires_at) as earliest_expiry,
        array_agg(id) as activity_ids
      FROM pawbucks_activity
      WHERE type = 'credit'
        AND pawbucks_status = 'available'
        AND expires_at IS NOT NULL
        AND expires_at > now()
        AND expires_at <= now() + (v_day || ' days')::interval
        AND NOT (expiry_reminder_sent_days @> ARRAY[v_day])
      GROUP BY user_id
    LOOP
      -- Build notification message
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

      -- Send notification
      INSERT INTO notifications (user_id, title, message, category)
      VALUES (v_record.user_id, v_title, v_message, 'transactional');

      -- Mark these records as reminded for this threshold
      UPDATE pawbucks_activity
      SET expiry_reminder_sent_days = array_append(COALESCE(expiry_reminder_sent_days, '{}'), v_day)
      WHERE id = ANY(v_record.activity_ids);

      v_reminder_count := v_reminder_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_reminder_count;
END;
$$;
