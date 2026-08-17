-- 1) merchant_twilio_settings: remove all client write access; server-side only
DROP POLICY IF EXISTS "Merchants can insert own twilio settings" ON public.merchant_twilio_settings;
DROP POLICY IF EXISTS "Merchants can update own twilio settings" ON public.merchant_twilio_settings;
DROP POLICY IF EXISTS "Merchants can delete own twilio settings" ON public.merchant_twilio_settings;

REVOKE INSERT, UPDATE, DELETE, SELECT, REFERENCES, TRIGGER, TRUNCATE ON public.merchant_twilio_settings FROM authenticated;
REVOKE ALL ON public.merchant_twilio_settings FROM anon;
GRANT ALL ON public.merchant_twilio_settings TO service_role;

CREATE POLICY "No direct client writes of twilio settings"
ON public.merchant_twilio_settings
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- 2) invoices: require a confirmed email before email-matched client access
CREATE OR REPLACE FUNCTION public.current_user_email_confirmed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.email_confirmed_at IS NOT NULL
  )
$$;

REVOKE ALL ON FUNCTION public.current_user_email_confirmed() FROM public;
GRANT EXECUTE ON FUNCTION public.current_user_email_confirmed() TO authenticated, service_role;

DROP POLICY IF EXISTS "Clients can view their own invoices" ON public.invoices;

CREATE POLICY "Clients can view their own invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  client_email IS NOT NULL
  AND client_email = public.get_current_user_email()
  AND public.current_user_email_confirmed()
);