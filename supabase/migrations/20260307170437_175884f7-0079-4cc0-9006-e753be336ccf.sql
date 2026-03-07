
-- Fix 1: Fix the handle_new_user function - jsonb can't cast directly to boolean
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  INSERT INTO public.profiles (id, email, full_name, user_type, normalized_email)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _user_type,
    _normalized_email
  );

  IF _user_type = 'pet_owner' THEN
    SELECT COALESCE((value::text)::boolean, true) INTO _welcome_credit_enabled
    FROM public.platform_settings
    WHERE key = 'welcome_credit_enabled';
    
    IF _welcome_credit_enabled IS NULL THEN
      _welcome_credit_enabled := true;
    END IF;

    IF NOT _welcome_credit_enabled THEN
      INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
      VALUES ('credit_skipped_program_paused', NEW.id, jsonb_build_object(
        'email', NEW.email,
        'reason', 'welcome_credit_program_paused'
      ));
    ELSE
      SELECT ca.is_abusive, ca.reason INTO _is_abusive, _abuse_reason
      FROM public.check_welcome_credit_abuse(NEW.email, _phone) ca;
      
      IF COALESCE(_is_abusive, FALSE) THEN
        INSERT INTO public.welcome_credit_abuse_signals (user_id, signal_type, signal_data, severity)
        VALUES (NEW.id, 'signup_abuse_blocked', jsonb_build_object(
          'reason', _abuse_reason,
          'email', NEW.email,
          'normalized_email', _normalized_email,
          'phone', _phone
        ), 'critical');

        INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
        VALUES ('credit_blocked', NEW.id, jsonb_build_object(
          'reason', _abuse_reason,
          'email', NEW.email,
          'normalized_email', _normalized_email
        ));
      ELSE
        _expires_at := now() + interval '45 days';
        
        INSERT INTO public.user_welcome_credits (user_id, credit_amount, status, expires_at, phase_1_amount, phase_2_amount, phase_2_unlocked)
        VALUES (NEW.id, 30000, 'active', _expires_at, 30000, 20000, false)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
        VALUES ('credit_issued', NEW.id, jsonb_build_object(
          'amount', 30000,
          'phase_1_amount', 30000,
          'phase_2_amount', 20000,
          'expires_at', _expires_at,
          'source', 'auto_signup'
        ));

        INSERT INTO public.notifications (user_id, title, message, category)
        VALUES (
          NEW.id,
          '🎉 30,000 PawBucks Welcome Credit!',
          'You have $30 toward your first booking! Complete your first transaction to unlock an additional $20 bonus. Use it before it expires!',
          'promotional'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user trigger error for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  RAISE;
END;
$$;

-- Fix 2: Reattach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
