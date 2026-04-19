
-- ============================================================
-- 1. Extend brand_campaigns with guardrails, targeting, funding
-- ============================================================
ALTER TABLE public.brand_campaigns
  ADD COLUMN IF NOT EXISTS daily_spend_cap integer,
  ADD COLUMN IF NOT EXISTS auto_pause_threshold_pct integer CHECK (auto_pause_threshold_pct IS NULL OR (auto_pause_threshold_pct > 0 AND auto_pause_threshold_pct <= 100)),
  ADD COLUMN IF NOT EXISTS auto_replenish_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_replenish_threshold integer,
  ADD COLUMN IF NOT EXISTS auto_replenish_amount_usd numeric(10,2),
  ADD COLUMN IF NOT EXISTS targeting_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS funding_method text NOT NULL DEFAULT 'invoice' CHECK (funding_method IN ('invoice', 'self_serve')),
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS funded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_brand_campaigns_status ON public.brand_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_brand_campaigns_brand_status ON public.brand_campaigns(brand_id, status);

-- ============================================================
-- 2. Auto-enroll rules table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_campaign_auto_enroll_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  business_category text,
  center_zip text,
  zip_radius_miles integer DEFAULT 25,
  max_merchants integer DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  enrolled_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_campaign_auto_enroll_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auto_enroll_campaign ON public.brand_campaign_auto_enroll_rules(campaign_id);

CREATE POLICY "Brand owners manage their auto-enroll rules"
  ON public.brand_campaign_auto_enroll_rules
  FOR ALL
  USING (public.user_owns_brand_campaign(auth.uid(), campaign_id))
  WITH CHECK (public.user_owns_brand_campaign(auth.uid(), campaign_id));

CREATE POLICY "Admins manage all auto-enroll rules"
  ON public.brand_campaign_auto_enroll_rules
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_auto_enroll_updated_at
  BEFORE UPDATE ON public.brand_campaign_auto_enroll_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Campaign invitations to merchants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_campaign_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  message text,
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, merchant_id)
);

ALTER TABLE public.brand_campaign_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invitations_campaign ON public.brand_campaign_invitations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_invitations_merchant ON public.brand_campaign_invitations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.brand_campaign_invitations(status);

CREATE POLICY "Brand owners manage invitations for their campaigns"
  ON public.brand_campaign_invitations
  FOR ALL
  USING (public.user_owns_brand_campaign(auth.uid(), campaign_id))
  WITH CHECK (public.user_owns_brand_campaign(auth.uid(), campaign_id));

CREATE POLICY "Merchants view invitations sent to them"
  ON public.brand_campaign_invitations
  FOR SELECT
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchants update their invitation responses"
  ON public.brand_campaign_invitations
  FOR UPDATE
  USING (public.user_owns_merchant(merchant_id))
  WITH CHECK (public.user_owns_merchant(merchant_id));

CREATE POLICY "Admins manage all invitations"
  ON public.brand_campaign_invitations
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_invitations_updated_at
  BEFORE UPDATE ON public.brand_campaign_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Daily stats aggregation table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_campaign_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  checkins integer NOT NULL DEFAULT 0,
  redemptions integer NOT NULL DEFAULT 0,
  pawbucks_distributed integer NOT NULL DEFAULT 0,
  pawbucks_redeemed integer NOT NULL DEFAULT 0,
  spend_usd numeric(12,2) NOT NULL DEFAULT 0,
  unique_users integer NOT NULL DEFAULT 0,
  unique_merchants integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, date)
);

ALTER TABLE public.brand_campaign_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_daily_stats_campaign_date ON public.brand_campaign_daily_stats(campaign_id, date DESC);

CREATE POLICY "Brand owners view their campaign stats"
  ON public.brand_campaign_daily_stats
  FOR SELECT
  USING (public.user_owns_brand_campaign(auth.uid(), campaign_id));

CREATE POLICY "Admins manage all stats"
  ON public.brand_campaign_daily_stats
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_daily_stats_updated_at
  BEFORE UPDATE ON public.brand_campaign_daily_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Aggregator function for daily stats (run by cron later)
-- ============================================================
CREATE OR REPLACE FUNCTION public.aggregate_brand_campaign_daily_stats(target_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.brand_campaign_daily_stats (
    campaign_id, date, checkins, redemptions,
    pawbucks_distributed, pawbucks_redeemed, spend_usd,
    unique_users, unique_merchants
  )
  SELECT
    a.campaign_id,
    target_date,
    COUNT(*) FILTER (WHERE a.type = 'earn'),
    COUNT(*) FILTER (WHERE a.type = 'redeem'),
    COALESCE(SUM(a.amount) FILTER (WHERE a.type = 'earn'), 0),
    COALESCE(SUM(a.amount) FILTER (WHERE a.type = 'redeem'), 0),
    ROUND(COALESCE(SUM(a.amount) FILTER (WHERE a.type = 'earn'), 0) / 1000.0, 2),
    COUNT(DISTINCT a.user_id),
    COUNT(DISTINCT a.merchant_id) FILTER (WHERE a.merchant_id IS NOT NULL)
  FROM public.branded_pawbucks_activity a
  WHERE a.created_at::date = target_date
  GROUP BY a.campaign_id
  ON CONFLICT (campaign_id, date)
  DO UPDATE SET
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
