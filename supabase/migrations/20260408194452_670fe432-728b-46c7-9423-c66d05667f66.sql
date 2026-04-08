DROP VIEW IF EXISTS public.merchant_twilio_settings_safe;

CREATE VIEW public.merchant_twilio_settings_safe AS
SELECT
  mts.id,
  mts.merchant_id,
  mts.twilio_account_sid,
  '••••••••••••••••'::text AS twilio_auth_token,
  mts.twilio_phone_number,
  mts.is_verified,
  mts.created_at,
  mts.updated_at
FROM public.merchant_twilio_settings mts
WHERE public.user_owns_merchant(mts.merchant_id)
   OR public.has_role(auth.uid(), 'admin'::public.app_role)
   OR public.has_role(auth.uid(), 'superadmin'::public.app_role);

REVOKE ALL ON public.merchant_twilio_settings_safe FROM PUBLIC;
GRANT SELECT ON public.merchant_twilio_settings_safe TO authenticated;

DROP POLICY IF EXISTS "Merchants can view own twilio settings" ON public.merchant_twilio_settings;
DROP POLICY IF EXISTS "No direct client reads of twilio settings" ON public.merchant_twilio_settings;

CREATE POLICY "No direct client reads of twilio settings"
ON public.merchant_twilio_settings
FOR SELECT
TO authenticated
USING (false);