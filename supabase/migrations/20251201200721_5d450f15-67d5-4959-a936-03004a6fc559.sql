-- Create analytics products table
CREATE TABLE public.merchant_analytics_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('subscription', 'one_time')),
  billing_period TEXT CHECK (billing_period IN ('monthly', 'quarterly', 'yearly')),
  price_usd NUMERIC NOT NULL,
  price_pawbucks INTEGER NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create merchant analytics subscriptions table
CREATE TABLE public.merchant_analytics_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.merchant_analytics_products(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('usd', 'pawbucks')),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(merchant_id, product_id, status)
);

-- Create merchant analytics purchases table (one-time reports)
CREATE TABLE public.merchant_analytics_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.merchant_analytics_products(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('usd', 'pawbucks')),
  amount_paid NUMERIC NOT NULL,
  report_data JSONB,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create merchant customer analytics table (for cohort analysis)
CREATE TABLE public.merchant_customer_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  first_transaction_date TIMESTAMP WITH TIME ZONE,
  last_transaction_date TIMESTAMP WITH TIME ZONE,
  total_transactions INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  average_order_value NUMERIC DEFAULT 0,
  lifetime_value NUMERIC DEFAULT 0,
  cohort_month TEXT,
  retention_rate NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(merchant_id, user_id)
);

-- Create merchant search analytics table (for keyword insights)
CREATE TABLE public.merchant_search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  search_term TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(merchant_id, search_term, date)
);

-- Enable RLS
ALTER TABLE public.merchant_analytics_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_analytics_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_analytics_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_customer_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_search_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analytics products
CREATE POLICY "Everyone can view active analytics products"
  ON public.merchant_analytics_products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage analytics products"
  ON public.merchant_analytics_products FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for subscriptions
CREATE POLICY "Merchants can view their own subscriptions"
  ON public.merchant_analytics_subscriptions FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can insert their own subscriptions"
  ON public.merchant_analytics_subscriptions FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update their own subscriptions"
  ON public.merchant_analytics_subscriptions FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all subscriptions"
  ON public.merchant_analytics_subscriptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for purchases
CREATE POLICY "Merchants can view their own purchases"
  ON public.merchant_analytics_purchases FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can insert their own purchases"
  ON public.merchant_analytics_purchases FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all purchases"
  ON public.merchant_analytics_purchases FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for customer analytics
CREATE POLICY "Merchants can view their own customer analytics"
  ON public.merchant_customer_analytics FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can manage customer analytics"
  ON public.merchant_customer_analytics FOR ALL
  USING (true);

-- RLS Policies for search analytics
CREATE POLICY "Merchants can view their own search analytics"
  ON public.merchant_search_analytics FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can manage search analytics"
  ON public.merchant_search_analytics FOR ALL
  USING (true);

-- Insert default analytics products
INSERT INTO public.merchant_analytics_products (name, description, product_type, billing_period, price_usd, price_pawbucks, features) VALUES
(
  'Premium Analytics Dashboard',
  'Advanced data views with customer demographics, transaction velocity reports, and competitive benchmarking',
  'subscription',
  'monthly',
  99.00,
  840,
  '["Customer Demographics", "Transaction Velocity Reports", "Competitive Benchmarking", "Location Heatmaps", "Real-time Data"]'::jsonb
),
(
  'Customer Cohort Analysis Report',
  'Detailed breakdown of customer base by retention rate, lifetime value, and average order value',
  'one_time',
  NULL,
  199.00,
  1690,
  '["Retention Rate Analysis", "Lifetime Value Breakdown", "Average Order Value", "Customer Segmentation"]'::jsonb
),
(
  'Predictive Demand Forecasting',
  'Algorithm-driven quarterly report for peak booking times and demand prediction',
  'one_time',
  'quarterly',
  399.00,
  3390,
  '["Peak Booking Predictions", "Demand Forecasting", "Price Optimization Suggestions", "Historical Trend Analysis"]'::jsonb
),
(
  'Keyword Performance Insights',
  'Quarterly report on search terms leading to your listing with optimization suggestions',
  'one_time',
  'quarterly',
  179.00,
  1520,
  '["Search Term Analysis", "Click-through Rates", "Conversion Tracking", "SEO Optimization Tips"]'::jsonb
);

-- Create trigger for updated_at
CREATE TRIGGER update_merchant_analytics_subscriptions_updated_at
  BEFORE UPDATE ON public.merchant_analytics_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merchant_customer_analytics_updated_at
  BEFORE UPDATE ON public.merchant_customer_analytics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merchant_analytics_products_updated_at
  BEFORE UPDATE ON public.merchant_analytics_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();