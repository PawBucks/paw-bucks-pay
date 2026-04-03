CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_stripe_pi 
ON public.transactions (stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;