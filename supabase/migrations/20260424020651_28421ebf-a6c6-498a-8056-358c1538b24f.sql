DROP FUNCTION IF EXISTS public.process_checkin(text, uuid);

CREATE OR REPLACE FUNCTION public.process_checkin(p_token text, p_user_id uuid)
RETURNS TABLE(success boolean, entity_name text, entity_type text, message text, merchant_id uuid, vet_id uuid, checkin_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant RECORD;
  v_vet RECORD;
  v_checkin_id uuid;
BEGIN
  SELECT id, business_name INTO v_merchant FROM merchants WHERE checkin_qr_token = p_token;
  IF FOUND THEN
    INSERT INTO checkins (merchant_id, user_id, checkin_token)
    VALUES (v_merchant.id, p_user_id, p_token)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_checkin_id;

    IF v_checkin_id IS NULL THEN
      RETURN QUERY SELECT FALSE, v_merchant.business_name, 'merchant'::TEXT, 'You have already checked in today'::TEXT, v_merchant.id, NULL::uuid, NULL::uuid;
      RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, v_merchant.business_name, 'merchant'::TEXT, 'Successfully checked in!'::TEXT, v_merchant.id, NULL::uuid, v_checkin_id;
    RETURN;
  END IF;

  SELECT id, clinic_name, name INTO v_vet FROM partner_vets WHERE checkin_qr_token = p_token;
  IF FOUND THEN
    INSERT INTO checkins (vet_id, user_id, checkin_token)
    VALUES (v_vet.id, p_user_id, p_token)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_checkin_id;

    IF v_checkin_id IS NULL THEN
      RETURN QUERY SELECT FALSE, COALESCE(v_vet.clinic_name, v_vet.name), 'vet'::TEXT, 'You have already checked in today'::TEXT, NULL::uuid, v_vet.id, NULL::uuid;
      RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, COALESCE(v_vet.clinic_name, v_vet.name), 'vet'::TEXT, 'Successfully checked in!'::TEXT, NULL::uuid, v_vet.id, v_checkin_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, 'Invalid QR code'::TEXT, NULL::uuid, NULL::uuid, NULL::uuid;
END;
$function$;