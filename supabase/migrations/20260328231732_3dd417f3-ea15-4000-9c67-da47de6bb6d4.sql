
-- Table to track conversion events attributed to merchant market services
CREATE TABLE public.service_conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  event_type text NOT NULL, -- 'impression', 'click', 'profile_view', 'transaction', 'review', 'booking'
  user_id uuid,
  session_id text,
  source_page text, -- 'discover', 'search', 'directory', 'map', 'profile'
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for merchant dashboard queries
CREATE INDEX idx_service_conversion_merchant_service ON public.service_conversion_events(merchant_id, service_name, event_type);
CREATE INDEX idx_service_conversion_created ON public.service_conversion_events(created_at);

-- RLS: service_role only for inserts (via edge function), merchants can read own data
ALTER TABLE public.service_conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own conversion events"
  ON public.service_conversion_events
  FOR SELECT
  TO authenticated
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Service role can insert conversion events"
  ON public.service_conversion_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Aggregated daily stats for performance dashboard
CREATE TABLE public.service_performance_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  profile_views integer DEFAULT 0,
  transactions integer DEFAULT 0,
  transaction_revenue numeric(12,2) DEFAULT 0,
  reviews integer DEFAULT 0,
  bookings integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, service_name, date)
);

ALTER TABLE public.service_performance_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own performance stats"
  ON public.service_performance_daily
  FOR SELECT
  TO authenticated
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Service role can manage performance stats"
  ON public.service_performance_daily
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to aggregate conversion events into daily stats
CREATE OR REPLACE FUNCTION public.aggregate_service_performance(target_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.service_performance_daily (
    merchant_id, service_name, date,
    impressions, clicks, profile_views, transactions, transaction_revenue, reviews, bookings
  )
  SELECT
    e.merchant_id,
    e.service_name,
    target_date,
    COUNT(*) FILTER (WHERE e.event_type = 'impression'),
    COUNT(*) FILTER (WHERE e.event_type = 'click'),
    COUNT(*) FILTER (WHERE e.event_type = 'profile_view'),
    COUNT(*) FILTER (WHERE e.event_type = 'transaction'),
    COALESCE(SUM((e.metadata->>'amount')::numeric) FILTER (WHERE e.event_type = 'transaction'), 0),
    COUNT(*) FILTER (WHERE e.event_type = 'review'),
    COUNT(*) FILTER (WHERE e.event_type = 'booking')
  FROM public.service_conversion_events e
  WHERE e.created_at::date = target_date
  GROUP BY e.merchant_id, e.service_name
  ON CONFLICT (merchant_id, service_name, date)
  DO UPDATE SET
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    profile_views = EXCLUDED.profile_views,
    transactions = EXCLUDED.transactions,
    transaction_revenue = EXCLUDED.transaction_revenue,
    reviews = EXCLUDED.reviews,
    bookings = EXCLUDED.bookings,
    updated_at = now();
END;
$$;
