
-- 1. Add timezone to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- 2. Update trigger to use the user's timezone
CREATE OR REPLACE FUNCTION public.set_pawbucks_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tz text;
BEGIN
  IF NEW.type = 'credit' AND NEW.expires_at IS NULL THEN
    IF NEW.source NOT IN ('pet_fund', 'welcome_credit', 'branded', 'campaign', 'referral_bonus') THEN
      -- Get user's timezone, default to Eastern
      SELECT COALESCE(timezone, 'America/New_York') INTO v_tz
      FROM profiles WHERE id = NEW.user_id;
      
      v_tz := COALESCE(v_tz, 'America/New_York');
      
      -- Set expiration to midnight in the user's local timezone on the 60th day
      NEW.expires_at := (
        (COALESCE(NEW.created_at, now()) AT TIME ZONE v_tz)::date 
        + INTERVAL '60 days'
      ) AT TIME ZONE v_tz;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Update expire function (comparison is straightforward since expires_at is already stored in UTC)
-- No change needed - the existing `expires_at <= now()` comparison works correctly
-- because expires_at was already converted to UTC when stored
