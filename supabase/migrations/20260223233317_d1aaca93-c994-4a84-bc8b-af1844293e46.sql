
-- Update handle_new_user to check welcome_credit_enabled platform setting before issuing credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_type user_type;
  _expires_at timestamptz;
  _normalized_email text;
  _is_abusive boolean;
  _abuse_reason text;
  _phone text;
  _welcome_credit_enabled boolean;
BEGIN
  _user_type := COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'pet_owner');
  _normalized_email := normalize_email(NEW.email);
  _phone := NEW.raw_user_meta_data->>'phone';
  
  -- Create profile with normalized email
  INSERT INTO public.profiles (id, email, full_name, user_type, normalized_email)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _user_type,
    _normalized_email
  );

  -- Auto-issue welcome credit for pet owners (with abuse checks)
  IF _user_type = 'pet_owner' THEN
    -- Check if welcome credit program is enabled
    SELECT COALESCE((value)::boolean, true) INTO _welcome_credit_enabled
    FROM public.platform_settings
    WHERE key = 'welcome_credit_enabled';
    
    -- Default to true if no setting exists
    IF _welcome_credit_enabled IS NULL THEN
      _welcome_credit_enabled := true;
    END IF;

    IF NOT _welcome_credit_enabled THEN
      -- Program is paused, skip credit issuance but log it
      INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
      VALUES ('credit_skipped_program_paused', NEW.id, jsonb_build_object(
        'email', NEW.email,
        'reason', 'welcome_credit_program_paused'
      ));
    ELSE
      -- Run abuse detection
      SELECT ca.is_abusive, ca.reason INTO _is_abusive, _abuse_reason
      FROM public.check_welcome_credit_abuse(NEW.email, _phone) ca;
      
      IF COALESCE(_is_abusive, FALSE) THEN
        -- Log the blocked attempt but still allow account creation
        INSERT INTO public.welcome_credit_abuse_signals (user_id, signal_type, signal_data, severity)
        VALUES (NEW.id, 'signup_abuse_blocked', jsonb_build_object(
          'reason', _abuse_reason,
          'email', NEW.email,
          'normalized_email', _normalized_email,
          'phone', _phone
        ), 'critical');

        -- Log analytics
        INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
        VALUES ('credit_blocked', NEW.id, jsonb_build_object(
          'reason', _abuse_reason,
          'email', NEW.email,
          'normalized_email', _normalized_email
        ));
      ELSE
        _expires_at := now() + interval '45 days';
        
        INSERT INTO public.user_welcome_credits (user_id, credit_amount, status, expires_at)
        VALUES (NEW.id, 50000, 'active', _expires_at)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
        VALUES ('credit_issued', NEW.id, jsonb_build_object(
          'amount', 50000,
          'expires_at', _expires_at,
          'source', 'auto_signup'
        ));

        INSERT INTO public.notifications (user_id, title, message, category)
        VALUES (
          NEW.id,
          '🎉 50,000 PawBucks Welcome Credit!',
          'You have $50 toward your first booking with a participating partner. Use it before it expires!',
          'promotional'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
