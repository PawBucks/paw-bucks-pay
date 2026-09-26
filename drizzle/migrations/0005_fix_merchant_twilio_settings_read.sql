-- Allow merchants to read their own non-secret Twilio settings via the safe view.
-- The view merchant_twilio_settings_safe runs with security_invoker, so the caller
-- needs privileges on the underlying table. Grant SELECT on non-secret columns only
-- (never twilio_auth_token) and add an owner-scoped SELECT policy.

GRANT SELECT ON public.merchant_twilio_settings_safe TO authenticated;

GRANT SELECT (id, merchant_id, twilio_account_sid, twilio_phone_number, is_verified, created_at, updated_at)
  ON public.merchant_twilio_settings TO authenticated;

GRANT ALL ON public.merchant_twilio_settings TO service_role;

CREATE POLICY "Merchants can read own twilio settings"
  ON public.merchant_twilio_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id = merchant_twilio_settings.merchant_id
        AND m.user_id = auth.uid()
    )
  );