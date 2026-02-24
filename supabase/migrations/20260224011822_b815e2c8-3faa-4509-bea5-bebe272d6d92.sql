
-- Add phase tracking columns to user_welcome_credits
ALTER TABLE public.user_welcome_credits
  ADD COLUMN IF NOT EXISTS phase_1_amount integer NOT NULL DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS phase_2_amount integer NOT NULL DEFAULT 20000,
  ADD COLUMN IF NOT EXISTS phase_2_unlocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phase_2_unlocked_at timestamptz;

-- Update existing credits: mark all existing ones as fully unlocked (backwards compat)
UPDATE public.user_welcome_credits
SET phase_1_amount = 50000, phase_2_amount = 0, phase_2_unlocked = true, phase_2_unlocked_at = created_at
WHERE credit_amount = 50000;

-- Create function to unlock phase 2 after first successful transaction
CREATE OR REPLACE FUNCTION public.unlock_welcome_credit_phase2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_credit RECORD;
  v_transaction_count integer;
BEGIN
  -- Only process completed transactions for pet owners
  IF NEW.status != 'completed' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if user has an active welcome credit with phase 2 still locked
  SELECT * INTO v_credit
  FROM user_welcome_credits
  WHERE user_id = NEW.user_id
    AND status = 'active'
    AND phase_2_unlocked = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Check this is the user's first completed transaction
  SELECT COUNT(*) INTO v_transaction_count
  FROM transactions
  WHERE user_id = NEW.user_id AND status = 'completed';

  -- This trigger fires AFTER insert, so count includes current transaction
  IF v_transaction_count = 1 THEN
    -- Unlock phase 2
    UPDATE user_welcome_credits
    SET
      credit_amount = phase_1_amount + phase_2_amount,
      phase_2_unlocked = true,
      phase_2_unlocked_at = now(),
      updated_at = now()
    WHERE id = v_credit.id;

    -- Log analytics
    INSERT INTO welcome_credit_analytics (event_type, user_id, event_data)
    VALUES ('phase_2_unlocked', NEW.user_id, jsonb_build_object(
      'credit_id', v_credit.id,
      'phase_2_amount', v_credit.phase_2_amount,
      'new_total', v_credit.phase_1_amount + v_credit.phase_2_amount,
      'transaction_id', NEW.id
    ));

    -- Notify user
    INSERT INTO notifications (user_id, title, message, category)
    VALUES (
      NEW.user_id,
      '🎉 20,000 Bonus PawBucks Unlocked!',
      'Congratulations on your first transaction! Your remaining $20 welcome credit is now available. Use it before it expires!',
      'promotional'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS unlock_welcome_credit_phase2_trigger ON transactions;
CREATE TRIGGER unlock_welcome_credit_phase2_trigger
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION unlock_welcome_credit_phase2();

-- Update handle_new_user to issue 30k initially instead of 50k
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
      -- Run abuse detection
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
        
        -- Phase 1: Issue 30k immediately, 20k locked until first transaction
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
END;
$function$;

-- Update the issue_welcome_credit function for the new phase structure
CREATE OR REPLACE FUNCTION public.issue_welcome_credit(p_user_id uuid, p_device_fingerprint text DEFAULT NULL, p_ip_address text DEFAULT NULL)
RETURNS TABLE(success boolean, credit_id uuid, credit_amount integer, expires_at timestamptz, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_credit RECORD;
  v_new_credit_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT * INTO v_existing_credit FROM user_welcome_credits WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT FALSE, v_existing_credit.id, v_existing_credit.credit_amount, v_existing_credit.expires_at, 'Welcome credit already exists'::TEXT;
    RETURN;
  END IF;
  
  IF p_device_fingerprint IS NOT NULL THEN
    IF EXISTS(
      SELECT 1 FROM user_welcome_credits 
      WHERE device_fingerprint = p_device_fingerprint 
      AND status IN ('used', 'active')
    ) THEN
      INSERT INTO welcome_credit_abuse_signals (user_id, signal_type, signal_data, severity)
      VALUES (p_user_id, 'device_fingerprint_match', jsonb_build_object('fingerprint', p_device_fingerprint), 'high');
      
      RETURN QUERY SELECT FALSE, NULL::UUID, 0, NULL::TIMESTAMP WITH TIME ZONE, 'Not eligible for welcome credit'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  v_expires_at := now() + INTERVAL '45 days';
  
  -- Issue phase 1 (30k), phase 2 (20k) locked
  INSERT INTO user_welcome_credits (user_id, credit_amount, expires_at, device_fingerprint, ip_address, phase_1_amount, phase_2_amount, phase_2_unlocked)
  VALUES (p_user_id, 30000, v_expires_at, p_device_fingerprint, p_ip_address, 30000, 20000, false)
  RETURNING id INTO v_new_credit_id;
  
  INSERT INTO welcome_credit_analytics (event_type, user_id, event_data)
  VALUES ('credit_issued', p_user_id, jsonb_build_object('credit_id', v_new_credit_id, 'amount', 30000, 'phase_1', 30000, 'phase_2', 20000, 'expires_at', v_expires_at));
  
  RETURN QUERY SELECT TRUE, v_new_credit_id, 30000, v_expires_at, 'Welcome credit issued successfully'::TEXT;
END;
$function$;
