
-- Restrict sensitive credential columns from client roles. Service role retains access.

REVOKE SELECT (tax_id, license_number, npi_number, stripe_account_id, stripe_connect_account_id)
  ON public.partner_vets FROM anon, authenticated;

REVOKE SELECT (stripe_customer_id, normalized_email)
  ON public.profiles FROM anon, authenticated;

REVOKE SELECT (api_key_encrypted)
  ON public.vet_lab_integrations FROM anon, authenticated;

REVOKE SELECT (api_key_encrypted, webhook_secret)
  ON public.vet_pms_integrations FROM anon, authenticated;

REVOKE SELECT (secret)
  ON public.merchant_webhooks FROM anon, authenticated;

-- Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.protect_paid_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE v_tx_count INT; v_pay_count INT;
BEGIN
  IF COALESCE(OLD.amount_paid, 0) > 0 THEN
    RAISE EXCEPTION 'Cannot delete invoice % – it has payments applied ($%). Void or refund first.', OLD.invoice_number, OLD.amount_paid;
  END IF;
  SELECT COUNT(*) INTO v_pay_count FROM public.invoice_payments WHERE invoice_id = OLD.id;
  IF v_pay_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete invoice % – % payment record(s) reference it.', OLD.invoice_number, v_pay_count;
  END IF;
  SELECT COUNT(*) INTO v_tx_count FROM public.transactions
   WHERE merchant_id = OLD.merchant_id AND description ILIKE '%' || OLD.invoice_number || '%';
  IF v_tx_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete invoice % – % transaction(s) reference it.', OLD.invoice_number, v_tx_count;
  END IF;
  RETURN OLD;
END; $function$;
