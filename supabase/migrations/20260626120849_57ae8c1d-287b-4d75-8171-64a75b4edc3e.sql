
-- Revoke column-level SELECT on sensitive token/secret/PII columns from authenticated and anon
REVOKE SELECT (access_token) ON public.accountant_invitations FROM authenticated, anon;
REVOKE SELECT (access_token) ON public.admin_invoices FROM authenticated, anon;
REVOKE SELECT (invitation_token, tax_id) ON public.brand_accounts FROM authenticated, anon;
REVOKE SELECT (access_token) ON public.invoices FROM authenticated, anon;
REVOKE SELECT (secret) ON public.merchant_webhooks FROM authenticated, anon;
REVOKE SELECT (access_token, signer_ip_address) ON public.pet_consent_requests FROM authenticated, anon;
REVOKE SELECT (customer_email, customer_phone) ON public.pos_transactions FROM authenticated, anon;

-- Tighten merchant_webhooks DELETE policy explicitly to owner (drop & recreate)
DROP POLICY IF EXISTS "Merchants can delete their own webhooks" ON public.merchant_webhooks;
CREATE POLICY "Merchants can delete their own webhooks"
  ON public.merchant_webhooks
  FOR DELETE
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );
