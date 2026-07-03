
-- Revoke client-side SELECT on sensitive bearer/secret columns; keep service_role access.
REVOKE SELECT (access_token) ON public.accountant_invitations FROM anon, authenticated;
REVOKE SELECT (access_token) ON public.admin_invoices FROM anon, authenticated;
REVOKE SELECT (invitation_token) ON public.brand_accounts FROM anon, authenticated;
REVOKE SELECT (secret) ON public.merchant_webhooks FROM anon, authenticated;
REVOKE SELECT (access_token) ON public.pet_consent_requests FROM anon, authenticated;
REVOKE SELECT (bank_routing_number) ON public.invoice_settings FROM anon, authenticated;

-- Owner-only RPCs to retrieve tokens/secrets when the legitimate owner needs them client-side.

-- Merchant retrieves an accountant invitation token to build a portal link.
CREATE OR REPLACE FUNCTION public.get_accountant_invitation_token(p_invitation_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT ai.access_token INTO v_token
  FROM public.accountant_invitations ai
  JOIN public.merchants m ON m.id = ai.merchant_id
  WHERE ai.id = p_invitation_id
    AND m.user_id = auth.uid();
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.get_accountant_invitation_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accountant_invitation_token(uuid) TO authenticated;

-- Brand owner (or admin) retrieves the brand invitation/setup token.
CREATE OR REPLACE FUNCTION public.get_brand_invitation_token(p_brand_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT ba.invitation_token INTO v_token
  FROM public.brand_accounts ba
  WHERE ba.id = p_brand_id
    AND (ba.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.get_brand_invitation_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_brand_invitation_token(uuid) TO authenticated;

-- Merchant retrieves their own bank routing number for the invoice settings form.
CREATE OR REPLACE FUNCTION public.get_my_bank_routing_number(p_merchant_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val text;
BEGIN
  SELECT s.bank_routing_number INTO v_val
  FROM public.invoice_settings s
  JOIN public.merchants m ON m.id = s.merchant_id
  WHERE s.merchant_id = p_merchant_id
    AND m.user_id = auth.uid();
  RETURN v_val;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_bank_routing_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_bank_routing_number(uuid) TO authenticated;
