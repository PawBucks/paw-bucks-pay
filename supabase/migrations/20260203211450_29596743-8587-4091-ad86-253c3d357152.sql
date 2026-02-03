-- Table for merchant-defined subscription/recurring billing plans
CREATE TABLE public.merchant_subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  stripe_product_id TEXT, -- Product on connected account
  stripe_price_id TEXT,   -- Price on connected account (created when plan is published)
  name TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT NOT NULL DEFAULT 'usd',
  billing_interval TEXT NOT NULL DEFAULT 'month', -- day, week, month, year
  billing_interval_count INTEGER NOT NULL DEFAULT 1, -- e.g., "every 2 weeks" = interval=week, count=2
  is_active BOOLEAN NOT NULL DEFAULT true,
  features JSONB DEFAULT '[]'::jsonb, -- List of plan features/benefits
  trial_days INTEGER DEFAULT 0,
  max_subscribers INTEGER, -- Optional cap on subscribers
  current_subscribers INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_subscription_plans ENABLE ROW LEVEL SECURITY;

-- Merchants can manage their own plans
CREATE POLICY "Merchants can view their own plans"
  ON public.merchant_subscription_plans
  FOR SELECT
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Merchants can create their own plans"
  ON public.merchant_subscription_plans
  FOR INSERT
  WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Merchants can update their own plans"
  ON public.merchant_subscription_plans
  FOR UPDATE
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Merchants can delete their own plans"
  ON public.merchant_subscription_plans
  FOR DELETE
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Public can view active plans (for storefront display)
CREATE POLICY "Anyone can view active published plans"
  ON public.merchant_subscription_plans
  FOR SELECT
  USING (
    is_active = true AND stripe_price_id IS NOT NULL
  );

-- Index for fast lookups
CREATE INDEX idx_merchant_subscription_plans_merchant_id ON public.merchant_subscription_plans(merchant_id);
CREATE INDEX idx_merchant_subscription_plans_active ON public.merchant_subscription_plans(is_active, merchant_id);

-- Trigger for updated_at
CREATE TRIGGER update_merchant_subscription_plans_updated_at
  BEFORE UPDATE ON public.merchant_subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();