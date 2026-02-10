
-- Update handle_new_user to auto-issue welcome credit for pet owners
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_type user_type;
  _expires_at timestamptz;
BEGIN
  _user_type := COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'pet_owner');
  
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _user_type
  );

  -- Auto-issue welcome credit for pet owners
  IF _user_type = 'pet_owner' THEN
    _expires_at := now() + interval '45 days';
    
    INSERT INTO public.user_welcome_credits (user_id, credit_amount, status, expires_at)
    VALUES (NEW.id, 50000, 'active', _expires_at)
    ON CONFLICT DO NOTHING;

    -- Log analytics event
    INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
    VALUES ('credit_issued', NEW.id, jsonb_build_object(
      'amount', 50000,
      'expires_at', _expires_at,
      'source', 'auto_signup'
    ));

    -- Create notification
    INSERT INTO public.notifications (user_id, title, message, category)
    VALUES (
      NEW.id,
      '🎉 50,000 PawBucks Welcome Credit!',
      'You have $50 toward your first booking with a participating partner. Use it before it expires!',
      'promotional'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
