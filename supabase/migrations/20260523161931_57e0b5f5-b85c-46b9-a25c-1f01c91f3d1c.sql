-- 1) Backfill: force every existing profile to the new policy
UPDATE public.profiles
SET auto_redeem_mode = 'always',
    auto_redeem_pawbucks = true
WHERE auto_redeem_mode IS DISTINCT FROM 'always'
   OR auto_redeem_pawbucks IS DISTINCT FROM true;

-- 2) Change defaults so new rows start on the new policy
ALTER TABLE public.profiles
  ALTER COLUMN auto_redeem_mode SET DEFAULT 'always';
ALTER TABLE public.profiles
  ALTER COLUMN auto_redeem_pawbucks SET DEFAULT true;

-- 3) Trigger guard: any insert/update that tries to set a legacy value
--    is rewritten to 'always' / true. This enforces the policy even if
--    older client/edge code still writes the old values.
CREATE OR REPLACE FUNCTION public.enforce_always_auto_redeem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.auto_redeem_mode := 'always';
  NEW.auto_redeem_pawbucks := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_always_auto_redeem_trg ON public.profiles;
CREATE TRIGGER enforce_always_auto_redeem_trg
BEFORE INSERT OR UPDATE OF auto_redeem_mode, auto_redeem_pawbucks
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_always_auto_redeem();