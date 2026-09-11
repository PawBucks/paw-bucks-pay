-- Track referral credit applied against platform (Success) fees
CREATE TABLE IF NOT EXISTS public.pet_pro_referral_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  fee_cents_before integer NOT NULL DEFAULT 0,
  context text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pet_pro_referral_credit_usage TO authenticated;
GRANT ALL ON public.pet_pro_referral_credit_usage TO service_role;
ALTER TABLE public.pet_pro_referral_credit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pros view their own referral credit usage" ON public.pet_pro_referral_credit_usage;
CREATE POLICY "Pros view their own referral credit usage"
  ON public.pet_pro_referral_credit_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS pet_pro_referral_credit_usage_user_idx
  ON public.pet_pro_referral_credit_usage (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS pet_pro_referral_credit_usage_reference_idx
  ON public.pet_pro_referral_credit_usage (reference) WHERE reference IS NOT NULL;

ALTER TABLE public.pet_pro_referral_credits
  ADD COLUMN IF NOT EXISTS lifetime_applied_cents integer NOT NULL DEFAULT 0;

-- Atomically consume available referral credit against a platform fee.
-- Returns the number of cents applied (0 when there is no credit).
CREATE OR REPLACE FUNCTION public.consume_pet_pro_referral_credit(
  _user_id uuid,
  _fee_cents integer,
  _context text DEFAULT NULL,
  _reference text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer := 0;
  v_apply integer := 0;
BEGIN
  IF _user_id IS NULL OR _fee_cents IS NULL OR _fee_cents <= 0 THEN
    RETURN 0;
  END IF;

  -- Idempotency: the same payment reference never consumes credit twice.
  IF _reference IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pet_pro_referral_credit_usage WHERE reference = _reference
  ) THEN
    RETURN (SELECT amount_cents FROM public.pet_pro_referral_credit_usage WHERE reference = _reference);
  END IF;

  SELECT balance_cents INTO v_balance
  FROM public.pet_pro_referral_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance <= 0 THEN
    RETURN 0;
  END IF;

  v_apply := LEAST(v_balance, _fee_cents);

  UPDATE public.pet_pro_referral_credits
  SET balance_cents = balance_cents - v_apply,
      lifetime_applied_cents = lifetime_applied_cents + v_apply,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.pet_pro_referral_credit_usage
    (user_id, amount_cents, fee_cents_before, context, reference)
  VALUES (_user_id, v_apply, _fee_cents, _context, _reference);

  RETURN v_apply;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_pet_pro_referral_credit(uuid, integer, text, text) TO service_role;