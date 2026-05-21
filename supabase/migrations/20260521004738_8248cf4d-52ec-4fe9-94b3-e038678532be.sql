CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_type user_type;
  _normalized_email text;
  _is_abusive boolean;
  _abuse_reason text;
  _phone text;
  _welcome_credit_enabled boolean;
  _referred_by uuid;
  _referral_code text;
  _promo RECORD;
  _tier text;
  _cluster_id uuid;
  _total_amount integer;
  _upfront integer;
  _phone_verified boolean := false;
BEGIN
  _user_type := COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'pet_owner');
  _normalized_email := normalize_email(NEW.email);
  _phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');
  _referral_code := NEW.raw_user_meta_data->>'referral_code';

  -- Phone OTP verification temporarily disabled. Phone number is captured
  -- on the profile but marked as unverified until OTP flow is re-enabled.

  INSERT INTO public.profiles (id, email, full_name, user_type, normalized_email, phone, phone_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _user_type,
    _normalized_email,
    _phone,
    _phone_verified
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
        'reason', 'pet_fund_program_paused'
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
        IF _referral_code IS NOT NULL AND _referral_code != '' THEN
          SELECT id INTO _referred_by FROM public.profiles WHERE referral_code = _referral_code;
        END IF;

        SELECT * INTO _promo FROM public.get_active_promotion() LIMIT 1;
        _tier := COALESCE(_promo.series_tier, 'standard');
        _cluster_id := _promo.cluster_id;

        IF _cluster_id IS NOT NULL THEN
          _tier := public.claim_pet_fund_spot(_cluster_id);
          IF _tier IS NULL THEN _tier := 'standard'; END IF;
        END IF;

        PERFORM public.initialize_pet_fund(NEW.id, _referred_by, _tier, _cluster_id);

        CASE _tier
          WHEN 'series_a' THEN _total_amount := 250000; _upfront := 20000;
          WHEN 'series_b' THEN _total_amount := 150000; _upfront := 15000;
          WHEN 'series_c' THEN _total_amount := 75000; _upfront := 15000;
          ELSE _total_amount := 50000; _upfront := 10000;
        END CASE;

        INSERT INTO public.welcome_credit_analytics (event_type, user_id, event_data)
        VALUES ('pet_fund_created', NEW.id, jsonb_build_object(
          'total_amount', _total_amount,
          'immediate_release', _upfront,
          'series_tier', _tier,
          'cluster_id', _cluster_id,
          'referred_by', _referred_by
        ));

        INSERT INTO public.notifications (user_id, title, message, category)
        VALUES (
          NEW.id,
          '🎉 Welcome Credit Activated!',
          'Your $' || (_total_amount / 1000) || ' Pet Fund is live! $' || (_upfront / 1000) || ' is available now. Use it before it expires!',
          'promotional'
        );

        IF _referred_by IS NOT NULL THEN
          INSERT INTO public.referrals (referrer_id, referee_id)
          VALUES (_referred_by, NEW.id)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user trigger error for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  RAISE;
END;
$function$;