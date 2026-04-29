CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoice_payments_stripe_pi
ON public.invoice_payments (stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;