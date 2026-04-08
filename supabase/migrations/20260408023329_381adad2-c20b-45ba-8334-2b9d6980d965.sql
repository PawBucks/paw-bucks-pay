
CREATE OR REPLACE FUNCTION public.create_checkin_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_entity_name TEXT;
BEGIN
  IF NEW.merchant_id IS NOT NULL THEN
    SELECT business_name INTO v_entity_name FROM merchants WHERE id = NEW.merchant_id;
  ELSIF NEW.vet_id IS NOT NULL THEN
    SELECT clinic_name INTO v_entity_name FROM partner_vets WHERE id = NEW.vet_id;
  END IF;

  IF v_entity_name IS NULL THEN
    v_entity_name := 'this location';
  END IF;

  INSERT INTO checkin_followups (checkin_id, user_id, merchant_id, vet_id, entity_name, notify_at)
  VALUES (NEW.id, NEW.user_id, NEW.merchant_id, NEW.vet_id, v_entity_name, NEW.checked_in_at + INTERVAL '15 minutes');

  RETURN NEW;
END;
$$;
