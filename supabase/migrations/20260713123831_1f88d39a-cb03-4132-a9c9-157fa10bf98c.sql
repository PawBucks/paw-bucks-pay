
-- 1) Guardrail: expiration rows must always be redemptions
CREATE OR REPLACE FUNCTION public.validate_pawbucks_activity_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'expiration' AND NEW.type <> 'redeem' THEN
    RAISE EXCEPTION 'pawbucks_activity rows with source=expiration must have type=redeem (got type=%)', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pawbucks_activity_source ON public.pawbucks_activity;
CREATE TRIGGER trg_validate_pawbucks_activity_source
BEFORE INSERT OR UPDATE ON public.pawbucks_activity
FOR EACH ROW EXECUTE FUNCTION public.validate_pawbucks_activity_source();

-- 2) Global recompute across every wallet
DO $$
DECLARE
  u uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.pawbucks_wallet LOOP
    PERFORM public.recompute_pawbucks_wallet(u);
  END LOOP;
  FOR u IN
    SELECT DISTINCT user_id FROM public.pawbucks_activity
    WHERE user_id NOT IN (SELECT user_id FROM public.pawbucks_wallet)
  LOOP
    PERFORM public.recompute_pawbucks_wallet(u);
  END LOOP;
END $$;
