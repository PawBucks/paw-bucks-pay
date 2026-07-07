-- Add stripe_payment_intent_id to pawbucks_activity for DB-level idempotency on subscription earns.
ALTER TABLE public.pawbucks_activity
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Unique partial index: at most ONE earn per (user, payment intent).
-- Prevents duplicate PawBucks credits for the same Stripe charge even if
-- the crediting code runs twice (e.g. connect-webhook + create-merchant-subscription).
CREATE UNIQUE INDEX IF NOT EXISTS pawbucks_activity_unique_earn_per_pi
  ON public.pawbucks_activity (user_id, stripe_payment_intent_id, type)
  WHERE stripe_payment_intent_id IS NOT NULL AND type = 'earn';

-- Also add uniqueness on merchant_subscription_events so a second "created" or
-- "renewed" insert for the same PI fails instead of silently duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS merchant_subscription_events_unique_pi_event
  ON public.merchant_subscription_events (payment_intent_id, event_type)
  WHERE payment_intent_id IS NOT NULL;