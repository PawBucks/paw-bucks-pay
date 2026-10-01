CREATE OR REPLACE FUNCTION public.create_app_notification(
  _target_user_id uuid, _title text, _message text,
  _category text DEFAULT 'transactional', _link_url text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _caller uuid := auth.uid();
  _allowed boolean := false;
  _id uuid;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF coalesce(length(trim(_title)),0) = 0 OR length(_title) > 200 OR length(coalesce(_message,'')) > 2000 OR length(coalesce(_link_url,'')) > 500 THEN
    RAISE EXCEPTION 'Invalid notification content' USING ERRCODE = '22023';
  END IF;
  IF _target_user_id IS NULL THEN
    _allowed := _category = 'consultation';
  ELSIF _target_user_id = _caller THEN
    _allowed := true;
  ELSIF public.has_role(_caller, 'admin') OR public.has_role(_caller, 'superadmin') THEN
    _allowed := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM service_bookings b JOIN merchants m ON m.id = b.merchant_id
      WHERE m.user_id = _caller AND b.user_id = _target_user_id
      UNION ALL
      SELECT 1 FROM service_bookings b JOIN merchants m ON m.id = b.merchant_id
      WHERE b.user_id = _caller AND m.user_id = _target_user_id
      UNION ALL
      SELECT 1 FROM grooming_report_cards g JOIN merchants m ON m.id = g.merchant_id
      WHERE m.user_id = _caller AND g.customer_user_id = _target_user_id
      UNION ALL
      SELECT 1 FROM prescription_refill_requests r JOIN partner_vets v ON v.id = r.vet_id
      WHERE v.user_id = _caller AND r.user_id = _target_user_id
      UNION ALL
      SELECT 1 FROM pet_medical_records r JOIN partner_vets v ON v.id = r.vet_id
      WHERE v.user_id = _caller AND r.user_id = _target_user_id
      UNION ALL
      SELECT 1 FROM compliance_reminders c JOIN partner_vets v ON v.id = c.vet_id
      JOIN pet_profiles p ON p.id = c.pet_id
      WHERE v.user_id = _caller AND p.user_id = _target_user_id
      UNION ALL
      SELECT 1 FROM pet_medical_visits mv JOIN partner_vets v ON v.id = mv.vet_id
      WHERE v.user_id = _caller AND mv.user_id = _target_user_id
    ) INTO _allowed;
  END IF;
  IF NOT _allowed THEN
    RAISE EXCEPTION 'Not allowed to notify this user' USING ERRCODE = '42501';
  END IF;
  INSERT INTO notifications (user_id, title, message, category, link_url, is_read)
  VALUES (_target_user_id, _title, _message, coalesce(_category,'transactional'), _link_url, false)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_app_notification(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_app_notification(uuid, text, text, text, text) TO authenticated;