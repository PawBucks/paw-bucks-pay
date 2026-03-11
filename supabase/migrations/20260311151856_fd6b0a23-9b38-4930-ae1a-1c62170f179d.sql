
CREATE OR REPLACE FUNCTION public.notify_on_merchant_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recipient_id uuid;
  v_sender_name text;
  v_should_notify boolean := true;
BEGIN
  IF NEW.sender_type = 'customer' THEN
    -- Customer sent message → notify merchant owner
    SELECT m.user_id INTO v_recipient_id
    FROM merchants m WHERE m.id = NEW.merchant_id;

    SELECT COALESCE(p.full_name, 'A customer') INTO v_sender_name
    FROM profiles p WHERE p.id = NEW.user_id;
  ELSIF NEW.sender_type = 'merchant' THEN
    -- Merchant sent message → notify customer
    v_recipient_id := NEW.user_id;

    SELECT COALESCE(m.business_name, 'A merchant') INTO v_sender_name
    FROM merchants m WHERE m.id = NEW.merchant_id;
  END IF;

  IF v_recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check notification preferences (transactional)
  SELECT COALESCE(transactional, true) INTO v_should_notify
  FROM notification_preferences
  WHERE user_id = v_recipient_id;

  IF NOT FOUND THEN
    v_should_notify := true;
  END IF;

  IF v_should_notify THEN
    INSERT INTO notifications (user_id, title, message, category)
    VALUES (
      v_recipient_id,
      'New Message from ' || v_sender_name,
      LEFT(NEW.message, 100),
      'transactional'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_merchant_message_insert
AFTER INSERT ON public.merchant_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_merchant_message();
