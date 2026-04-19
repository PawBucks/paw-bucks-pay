
-- 1) Hourly stats table for real-time ROI
CREATE TABLE IF NOT EXISTS public.brand_campaign_hourly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  hour_bucket TIMESTAMPTZ NOT NULL,
  checkins INTEGER NOT NULL DEFAULT 0,
  redemptions INTEGER NOT NULL DEFAULT 0,
  pawbucks_distributed INTEGER NOT NULL DEFAULT 0,
  pawbucks_redeemed INTEGER NOT NULL DEFAULT 0,
  spend_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,
  unique_merchants INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_bchs_campaign_hour ON public.brand_campaign_hourly_stats(campaign_id, hour_bucket DESC);

ALTER TABLE public.brand_campaign_hourly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owners view own hourly stats"
ON public.brand_campaign_hourly_stats FOR SELECT
USING (public.user_owns_brand_campaign(auth.uid(), campaign_id));

CREATE POLICY "Participating merchants view hourly stats"
ON public.brand_campaign_hourly_stats FOR SELECT
USING (public.user_participates_in_campaign(auth.uid(), campaign_id));

CREATE POLICY "Admins view all hourly stats"
ON public.brand_campaign_hourly_stats FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','superadmin')));

CREATE POLICY "Service role manages hourly stats"
ON public.brand_campaign_hourly_stats FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2) Brand payment methods (for auto-replenish)
CREATE TABLE IF NOT EXISTS public.brand_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brand_accounts(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_payment_method_id TEXT NOT NULL,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, stripe_payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_bpm_brand ON public.brand_payment_methods(brand_id);

ALTER TABLE public.brand_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owners view own payment methods"
ON public.brand_payment_methods FOR SELECT
USING (EXISTS (SELECT 1 FROM public.brand_accounts ba WHERE ba.id = brand_id AND ba.user_id = auth.uid()));

CREATE POLICY "Brand owners delete own payment methods"
ON public.brand_payment_methods FOR DELETE
USING (EXISTS (SELECT 1 FROM public.brand_accounts ba WHERE ba.id = brand_id AND ba.user_id = auth.uid()));

CREATE POLICY "Service role manages payment methods"
ON public.brand_payment_methods FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3) Extend brand_campaigns with creative + guardrail metadata
ALTER TABLE public.brand_campaigns
  ADD COLUMN IF NOT EXISTS creative_headline TEXT,
  ADD COLUMN IF NOT EXISTS creative_subtext TEXT,
  ADD COLUMN IF NOT EXISTS creative_cta TEXT,
  ADD COLUMN IF NOT EXISTS last_auto_replenish_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_guardrail_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_reason TEXT;

-- 4) updated_at trigger for new tables
DROP TRIGGER IF EXISTS update_bchs_updated_at ON public.brand_campaign_hourly_stats;
CREATE TRIGGER update_bchs_updated_at
  BEFORE UPDATE ON public.brand_campaign_hourly_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bpm_updated_at ON public.brand_payment_methods;
CREATE TRIGGER update_bpm_updated_at
  BEFORE UPDATE ON public.brand_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Hourly aggregator function (called from edge or cron)
CREATE OR REPLACE FUNCTION public.aggregate_brand_campaign_hourly_stats(target_hour TIMESTAMPTZ DEFAULT date_trunc('hour', now()))
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.brand_campaign_hourly_stats (
    campaign_id, hour_bucket, checkins, redemptions,
    pawbucks_distributed, pawbucks_redeemed, spend_usd,
    unique_users, unique_merchants
  )
  SELECT
    a.campaign_id,
    target_hour,
    COUNT(*) FILTER (WHERE a.type = 'earn'),
    COUNT(*) FILTER (WHERE a.type = 'redeem'),
    COALESCE(SUM(a.amount) FILTER (WHERE a.type = 'earn'), 0),
    COALESCE(SUM(a.amount) FILTER (WHERE a.type = 'redeem'), 0),
    ROUND(COALESCE(SUM(a.amount) FILTER (WHERE a.type = 'earn'), 0) / 1000.0, 2),
    COUNT(DISTINCT a.user_id),
    COUNT(DISTINCT a.merchant_id) FILTER (WHERE a.merchant_id IS NOT NULL)
  FROM public.branded_pawbucks_activity a
  WHERE a.created_at >= target_hour
    AND a.created_at < target_hour + interval '1 hour'
  GROUP BY a.campaign_id
  ON CONFLICT (campaign_id, hour_bucket) DO UPDATE SET
    checkins = EXCLUDED.checkins,
    redemptions = EXCLUDED.redemptions,
    pawbucks_distributed = EXCLUDED.pawbucks_distributed,
    pawbucks_redeemed = EXCLUDED.pawbucks_redeemed,
    spend_usd = EXCLUDED.spend_usd,
    unique_users = EXCLUDED.unique_users,
    unique_merchants = EXCLUDED.unique_merchants,
    updated_at = now();
END;
$$;

-- 6) Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.branded_pawbucks_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_campaign_hourly_stats;
