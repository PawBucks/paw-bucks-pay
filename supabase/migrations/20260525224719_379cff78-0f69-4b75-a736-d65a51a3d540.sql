
CREATE OR REPLACE FUNCTION public.process_checkin_by_entity(
  p_entity_type text,
  p_entity_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  success boolean,
  entity_name text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF p_entity_type = 'merchant' THEN
    SELECT m.checkin_qr_token INTO v_token
    FROM public.merchants m
    WHERE m.id = p_entity_id
      AND m.approval_status = 'approved'
      AND COALESCE(m.is_paused, false) = false
    LIMIT 1;
  ELSIF p_entity_type = 'vet' THEN
    SELECT pv.checkin_qr_token INTO v_token
    FROM public.partner_vets pv
    WHERE pv.id = p_entity_id
      AND pv.is_verified = true
    LIMIT 1;
  ELSE
    RETURN QUERY SELECT false, NULL::text, 'Unknown entity type';
    RETURN;
  END IF;

  IF v_token IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, 'Location not available for check-in';
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pc.success, pc.entity_name, pc.message
  FROM public.process_checkin(v_token, p_user_id) AS pc;
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkin_by_entity(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkin_by_entity(text, uuid, uuid) TO authenticated;
