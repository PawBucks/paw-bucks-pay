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
  v_link_url text;
BEGIN
  IF NEW.sender_type = 'customer' THEN
    SELECT m.user_id INTO v_recipient_id
    FROM merchants m WHERE m.id = NEW.merchant_id;

    SELECT COALESCE(p.full_name, 'A customer') INTO v_sender_name
    FROM profiles p WHERE p.id = NEW.user_id;

    v_link_url := '/merchant/messages';
  ELSIF NEW.sender_type = 'merchant' THEN
    v_recipient_id := NEW.user_id;

    SELECT COALESCE(m.business_name, 'A merchant') INTO v_sender_name
    FROM merchants m WHERE m.id = NEW.merchant_id;

    v_link_url := '/merchant/' || NEW.merchant_id::text || '?openMessage=1';
  END IF;

  IF v_recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(transactional, true) INTO v_should_notify
  FROM notification_preferences
  WHERE user_id = v_recipient_id;

  IF NOT FOUND THEN
    v_should_notify := true;
  END IF;

  IF v_should_notify THEN
    INSERT INTO notifications (user_id, title, message, category, link_url)
    VALUES (
      v_recipient_id,
      'New Message from ' || v_sender_name,
      LEFT(NEW.message, 100),
      'transactional',
      v_link_url
    );
  END IF;

  RETURN NEW;
END;
$$;