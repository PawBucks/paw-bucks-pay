
-- 1. Add normalized_email column to profiles for alias detection
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS normalized_email text;

-- 2. Function to normalize emails (strip +aliases, strip dots for Gmail)
CREATE OR REPLACE FUNCTION public.normalize_email(raw_email text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  local_part text;
  domain_part text;
BEGIN
  raw_email := lower(trim(raw_email));
  local_part := split_part(raw_email, '@', 1);
  domain_part := split_part(raw_email, '@', 2);
  
  -- Strip +alias (e.g., user+test@gmail.com → user@gmail.com)
  local_part := split_part(local_part, '+', 1);
  
  -- Strip dots for Gmail/Googlemail (john.doe@gmail.com = johndoe@gmail.com)
  IF domain_part IN ('gmail.com', 'googlemail.com') THEN
    local_part := replace(local_part, '.', '');
    domain_part := 'gmail.com';
  END IF;
  
  RETURN local_part || '@' || domain_part;
END;
$$;

-- 3. Index for fast normalized email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_normalized_email ON public.profiles(normalized_email);

-- 4. Backfill existing profiles
UPDATE public.profiles SET normalized_email = normalize_email(email) WHERE normalized_email IS NULL AND email IS NOT NULL;

-- 5. Index on phone for dedup lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone) WHERE phone IS NOT NULL;

-- 6. Abuse check function: email alias, phone reuse, IP rate limiting
CREATE OR REPLACE FUNCTION public.check_welcome_credit_abuse(
  p_email text, 
  p_phone text DEFAULT NULL, 
  p_ip text DEFAULT NULL
)
RETURNS TABLE(is_abusive boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized text;
  v_match_count integer;
BEGIN
  v_normalized := normalize_email(p_email);
  
  -- Check 1: Normalized email already has a welcome credit
  SELECT COUNT(*) INTO v_match_count
  FROM user_welcome_credits uwc
  JOIN profiles p ON p.id = uwc.user_id
  WHERE p.normalized_email = v_normalized
  AND uwc.status IN ('active', 'used');
  
  IF v_match_count > 0 THEN
    RETURN QUERY SELECT TRUE, 'email_alias_detected'::text;
    RETURN;
  END IF;
  
  -- Check 2: Phone number already associated with a credit
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    SELECT COUNT(*) INTO v_match_count
    FROM user_welcome_credits uwc
    JOIN profiles p ON p.id = uwc.user_id
    WHERE p.phone = p_phone
    AND uwc.status IN ('active', 'used');
    
    IF v_match_count > 0 THEN
      RETURN QUERY SELECT TRUE, 'phone_number_reuse'::text;
      RETURN;
    END IF;
  END IF;
  
  -- Check 3: IP address rate limit (max 3 credits from same IP in 30 days)
  IF p_ip IS NOT NULL AND p_ip != '' THEN
    SELECT COUNT(*) INTO v_match_count
    FROM user_welcome_credits
    WHERE ip_address = p_ip
    AND created_at > now() - interval '30 days'
    AND status IN ('active', 'used');
    
    IF v_match_count >= 3 THEN
      RETURN QUERY SELECT TRUE, 'ip_rate_limit_exceeded'::text;
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY SELECT FALSE, NULL::text;
END;
$$;

-- 7. Update handle_new_user trigger to include abuse prevention
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_type user_type;
  _expires_at timestamptz;
  _normalized_email text;
  _is_abusive boolean;
  _abuse_reason text;
  _phone text;
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

  RETURN NEW;
END;
$$;

-- 8. Also update the edge function's abuse check: add normalized email index on welcome_credit_abuse_signals
CREATE INDEX IF NOT EXISTS idx_abuse_signals_user_id ON public.welcome_credit_abuse_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_signals_type ON public.welcome_credit_abuse_signals(signal_type);
