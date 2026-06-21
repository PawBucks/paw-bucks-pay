
CREATE OR REPLACE FUNCTION public.expire_pawbucks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expired_count integer := 0;
  v_record RECORD;
BEGIN
  FOR v_record IN
    SELECT id, user_id, amount
    FROM pawbucks_activity
    WHERE type = 'earn'
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

    -- Offset entry uses positive amount to satisfy the
    -- pawbucks_activity_amount_sign_check constraint
    -- (both earn and redeem require amount > 0).
    INSERT INTO pawbucks_activity (user_id, amount, type, source, description, pawbucks_status)
    VALUES (
      v_record.user_id,
      v_record.amount,
      'redeem',
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
$function$;
