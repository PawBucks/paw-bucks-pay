
-- Add phase_1_used tracking columns
ALTER TABLE public.user_welcome_credits
  ADD COLUMN IF NOT EXISTS phase_1_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phase_1_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS phase_1_used_with_merchant_id uuid REFERENCES public.merchants(id),
  ADD COLUMN IF NOT EXISTS phase_1_used_in_transaction_id uuid;

-- Replace redeem_welcome_credit to support two-stage phase redemption
CREATE OR REPLACE FUNCTION public.redeem_welcome_credit(p_user_id uuid, p_merchant_id uuid, p_transaction_total_cents integer, p_transaction_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(success boolean, credit_applied integer, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credit RECORD;
  v_min_transaction_cents INTEGER := 7500;
  v_credit_to_apply INTEGER;
BEGIN
  -- Enforce $75 minimum on ALL welcome credit redemptions
  IF p_transaction_total_cents < v_min_transaction_cents THEN
    RETURN QUERY SELECT FALSE, 0, 'Minimum transaction of $75 required to use welcome credit'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_credit
  FROM user_welcome_credits
  WHERE user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'No active welcome credit found'::TEXT;
    RETURN;
  END IF;

  -- Check merchant accepts PawBucks
  IF NOT EXISTS(SELECT 1 FROM merchants WHERE id = p_merchant_id AND accepts_pawbucks = true) THEN
    RETURN QUERY SELECT FALSE, 0, 'Merchant does not accept PawBucks'::TEXT;
    RETURN;
  END IF;

  IF v_credit.expires_at < now() THEN
    UPDATE user_welcome_credits SET status = 'expired', updated_at = now() WHERE id = v_credit.id;
    RETURN QUERY SELECT FALSE, 0, 'Welcome credit has expired'::TEXT;
    RETURN;
  END IF;

  -- PHASE 1: First purchase (30,000 PB)
  IF NOT v_credit.phase_1_used THEN
    v_credit_to_apply := LEAST(v_credit.phase_1_amount, p_transaction_total_cents);

    UPDATE user_welcome_credits
    SET
      phase_1_used = true,
      phase_1_used_at = now(),
      phase_1_used_with_merchant_id = p_merchant_id,
      phase_1_used_in_transaction_id = p_transaction_id,
      updated_at = now()
    WHERE id = v_credit.id;

    INSERT INTO welcome_credit_analytics (event_type, user_id, merchant_id, event_data)
    VALUES ('phase_1_used', p_user_id, p_merchant_id, jsonb_build_object(
      'credit_id', v_credit.id,
      'credit_applied', v_credit_to_apply,
      'phase', 1,
      'transaction_total', p_transaction_total_cents,
      'transaction_id', p_transaction_id
    ));

    RETURN QUERY SELECT TRUE, v_credit_to_apply, 'Phase 1 welcome credit applied ($30 max)'::TEXT;
    RETURN;
  END IF;

  -- PHASE 2: Second purchase (20,000 PB) - requires phase_2_unlocked
  IF v_credit.phase_1_used AND v_credit.phase_2_unlocked THEN
    v_credit_to_apply := LEAST(v_credit.phase_2_amount, p_transaction_total_cents);

    UPDATE user_welcome_credits
    SET
      status = 'used',
      used_at = now(),
      used_with_merchant_id = p_merchant_id,
      used_in_transaction_id = p_transaction_id,
      transaction_total_cents = p_transaction_total_cents,
      updated_at = now()
    WHERE id = v_credit.id;

    INSERT INTO welcome_credit_analytics (event_type, user_id, merchant_id, event_data)
    VALUES ('credit_used', p_user_id, p_merchant_id, jsonb_build_object(
      'credit_id', v_credit.id,
      'credit_applied', v_credit_to_apply,
      'phase', 2,
      'transaction_total', p_transaction_total_cents,
      'transaction_id', p_transaction_id
    ));

    RETURN QUERY SELECT TRUE, v_credit_to_apply, 'Phase 2 welcome credit applied ($20 max). Welcome credit fully used!'::TEXT;
    RETURN;
  END IF;

  -- Phase 1 used but phase 2 not yet unlocked
  IF v_credit.phase_1_used AND NOT v_credit.phase_2_unlocked THEN
    RETURN QUERY SELECT FALSE, 0, 'Phase 2 bonus not yet unlocked. Complete your first transaction to unlock!'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT FALSE, 0, 'No available welcome credit phase to redeem'::TEXT;
END;
$function$;
