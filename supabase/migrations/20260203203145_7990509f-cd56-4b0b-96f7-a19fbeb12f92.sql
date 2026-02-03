-- Merchant Subscriptions table for Direct Charge recurring billing
-- This tracks subscriptions where payments go TO merchants (not platform subscriptions)
CREATE TABLE public.merchant_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Owner (subscriber) info
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id_on_connected TEXT NOT NULL, -- Customer ID on the CONNECTED account
  -- Merchant (recipient) info  
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  connected_account_id TEXT NOT NULL, -- The merchant's Stripe Connect account ID
  -- Product/Price info
  stripe_price_id TEXT NOT NULL, -- The price ID on the connected account
  product_name TEXT NOT NULL,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT NOT NULL DEFAULT 'usd',
  billing_interval TEXT NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('day', 'week', 'month', 'year')),
  billing_interval_count INTEGER NOT NULL DEFAULT 1,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'paused', 'incomplete')),
  -- Billing dates
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Payment tracking
  last_payment_date TIMESTAMP WITH TIME ZONE,
  last_payment_intent_id TEXT,
  last_payment_status TEXT,
  failed_payment_count INTEGER NOT NULL DEFAULT 0,
  -- Application fee
  application_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 3.00, -- 3% platform fee
  -- Metadata
  metadata JSONB,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_merchant_subs_user ON public.merchant_subscriptions(user_id);
CREATE INDEX idx_merchant_subs_merchant ON public.merchant_subscriptions(merchant_id);
CREATE INDEX idx_merchant_subs_next_billing ON public.merchant_subscriptions(next_billing_date) WHERE status = 'active';
CREATE INDEX idx_merchant_subs_status ON public.merchant_subscriptions(status);
CREATE INDEX idx_merchant_subs_connected_account ON public.merchant_subscriptions(connected_account_id);

-- Subscription events log for auditing
CREATE TABLE public.merchant_subscription_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.merchant_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'renewed', 'payment_succeeded', 'payment_failed', 'canceled', 'paused', 'resumed'
  amount INTEGER, -- Amount charged (if applicable)
  payment_intent_id TEXT,
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchant_sub_events_sub ON public.merchant_subscription_events(subscription_id);
CREATE INDEX idx_merchant_sub_events_type ON public.merchant_subscription_events(event_type);

-- Trigger for updated_at
CREATE TRIGGER update_merchant_subscriptions_updated_at
  BEFORE UPDATE ON public.merchant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscription_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view their own merchant subscriptions"
  ON public.merchant_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Merchants can view subscriptions to their business
CREATE POLICY "Merchants can view subscriptions to their business"
  ON public.merchant_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id = merchant_subscriptions.merchant_id
      AND m.user_id = auth.uid()
    )
  );

-- Service role for edge functions
CREATE POLICY "Service role has full access to merchant subscriptions"
  ON public.merchant_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Events policies
CREATE POLICY "Users can view their subscription events"
  ON public.merchant_subscription_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_subscriptions ms
      WHERE ms.id = merchant_subscription_events.subscription_id
      AND ms.user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can view their subscription events"
  ON public.merchant_subscription_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_subscriptions ms
      JOIN public.merchants m ON m.id = ms.merchant_id
      WHERE ms.id = merchant_subscription_events.subscription_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to subscription events"
  ON public.merchant_subscription_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for subscription status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_subscriptions;