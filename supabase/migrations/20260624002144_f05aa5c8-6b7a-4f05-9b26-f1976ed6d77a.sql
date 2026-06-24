CREATE OR REPLACE FUNCTION public.set_pawbucks_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'earn' THEN
    IF NEW.source IN ('pet_fund', 'welcome_credit', 'branded', 'campaign', 'referral_bonus') THEN
      NEW.expires_at := NULL;
    ELSE
      -- Earned PawBucks expire 60 full days after the exact earn timestamp.
      -- Do not round to local midnight; that can shorten the window to ~59 days.
      NEW.expires_at := COALESCE(NEW.created_at, now()) + INTERVAL '60 days';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.normalize_earned_pawbucks_expiration()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_count integer := 0;
BEGIN
  UPDATE public.pawbucks_activity
  SET expires_at = created_at + INTERVAL '60 days'
  WHERE type = 'earn'
    AND pawbucks_status IN ('available', 'pending')
    AND source NOT IN ('pet_fund', 'welcome_credit', 'branded', 'campaign', 'referral_bonus')
    AND created_at IS NOT NULL
    AND (
      expires_at IS NULL
      OR abs(extract(epoch FROM (expires_at - (created_at + INTERVAL '60 days')))) > 60
    );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$function$;