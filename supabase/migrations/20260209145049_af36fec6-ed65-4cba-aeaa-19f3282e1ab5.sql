
-- Update check_welcome_credit_eligibility to use accepts_pawbucks instead of accepts_welcome_credit
CREATE OR REPLACE FUNCTION public.check_welcome_credit_eligibility(p_user_id uuid, p_merchant_id uuid)
 RETURNS TABLE(is_eligible boolean, reason text, credit_amount integer, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_credit RECORD;
  v_has_transactions BOOLEAN;
  v_has_merchant_transactions BOOLEAN;
  v_merchant_accepts_pawbucks BOOLEAN;
BEGIN
  SELECT * INTO v_has_credit
  FROM user_welcome_credits
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'No welcome credit issued'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  IF v_has_credit.status = 'used' THEN
    RETURN QUERY SELECT FALSE, 'Welcome credit already used'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  IF v_has_credit.status = 'expired' THEN
    RETURN QUERY SELECT FALSE, 'Welcome credit has expired'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  IF v_has_credit.status = 'revoked' THEN
    RETURN QUERY SELECT FALSE, 'Welcome credit was revoked'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  IF v_has_credit.expires_at < now() THEN
    UPDATE user_welcome_credits SET status = 'expired', updated_at = now() WHERE id = v_has_credit.id;
    RETURN QUERY SELECT FALSE, 'Welcome credit has expired'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  SELECT EXISTS(SELECT 1 FROM transactions WHERE user_id = p_user_id) INTO v_has_transactions;
  IF v_has_transactions THEN
    RETURN QUERY SELECT FALSE, 'Not eligible - not first transaction'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  SELECT EXISTS(SELECT 1 FROM transactions WHERE user_id = p_user_id AND merchant_id = p_merchant_id) INTO v_has_merchant_transactions;
  IF v_has_merchant_transactions THEN
    RETURN QUERY SELECT FALSE, 'Not eligible - not first transaction with merchant'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Check if merchant accepts PawBucks (replaces accepts_welcome_credit check)
  SELECT accepts_pawbucks INTO v_merchant_accepts_pawbucks FROM merchants WHERE id = p_merchant_id;
  IF NOT COALESCE(v_merchant_accepts_pawbucks, false) THEN
    RETURN QUERY SELECT FALSE, 'Merchant does not accept PawBucks'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, 'Eligible'::TEXT, v_has_credit.credit_amount, v_has_credit.expires_at;
END;
$function$;

-- Update redeem_welcome_credit to use accepts_pawbucks
CREATE OR REPLACE FUNCTION public.redeem_welcome_credit(p_user_id uuid, p_merchant_id uuid, p_transaction_total_cents integer, p_transaction_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(success boolean, credit_applied integer, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credit RECORD;
  v_min_transaction_cents INTEGER := 7500;
BEGIN
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
  
  -- Check merchant accepts PawBucks (replaces accepts_welcome_credit)
  IF NOT EXISTS(SELECT 1 FROM merchants WHERE id = p_merchant_id AND accepts_pawbucks = true) THEN
    RETURN QUERY SELECT FALSE, 0, 'Merchant does not accept PawBucks'::TEXT;
    RETURN;
  END IF;
  
  IF v_credit.expires_at < now() THEN
    UPDATE user_welcome_credits SET status = 'expired', updated_at = now() WHERE id = v_credit.id;
    RETURN QUERY SELECT FALSE, 0, 'Welcome credit has expired'::TEXT;
    RETURN;
  END IF;
  
  DECLARE
    v_credit_to_apply INTEGER;
  BEGIN
    v_credit_to_apply := LEAST(v_credit.credit_amount, p_transaction_total_cents);
    
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
      'transaction_total', p_transaction_total_cents,
      'transaction_id', p_transaction_id
    ));
    
    RETURN QUERY SELECT TRUE, v_credit_to_apply, 'Welcome credit applied successfully'::TEXT;
  END;
END;
$function$;
