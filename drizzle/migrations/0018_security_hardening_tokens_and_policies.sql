DROP POLICY IF EXISTS "Users can insert their own referral record" ON public.referrals;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Merchants can update own participation" ON public.brand_campaign_merchants;

CREATE OR REPLACE FUNCTION public.generate_checkin_qr_token()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    token := 'CHK-' || upper(encode(extensions.gen_random_bytes(12), 'hex'));
    SELECT EXISTS(
      SELECT 1 FROM merchants WHERE checkin_qr_token = token
      UNION ALL
      SELECT 1 FROM partner_vets WHERE checkin_qr_token = token
    ) INTO token_exists;
    EXIT WHEN NOT token_exists;
  END LOOP;
  RETURN token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_redemption_code()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := 'PBK-' || upper(encode(extensions.gen_random_bytes(8), 'hex'));
    SELECT EXISTS(SELECT 1 FROM offer_redemptions WHERE redemption_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$function$;