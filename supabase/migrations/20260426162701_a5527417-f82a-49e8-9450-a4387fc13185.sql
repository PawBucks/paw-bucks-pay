
-- =====================================================
-- Merchant-initiated brand campaign join requests
-- =====================================================

CREATE TABLE IF NOT EXISTS public.brand_campaign_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  message text,
  response_message text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, merchant_id)
);

ALTER TABLE public.brand_campaign_join_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_join_requests_campaign ON public.brand_campaign_join_requests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_merchant ON public.brand_campaign_join_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON public.brand_campaign_join_requests(status);

-- Merchants: view, create, and cancel their own requests
CREATE POLICY "Merchants view own join requests"
  ON public.brand_campaign_join_requests
  FOR SELECT
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchants create own join requests"
  ON public.brand_campaign_join_requests
  FOR INSERT
  WITH CHECK (public.user_owns_merchant(merchant_id) AND requested_by = auth.uid());

CREATE POLICY "Merchants cancel own pending requests"
  ON public.brand_campaign_join_requests
  FOR UPDATE
  USING (public.user_owns_merchant(merchant_id))
  WITH CHECK (public.user_owns_merchant(merchant_id));

-- Brand owners: view and respond to requests for their campaigns
CREATE POLICY "Brand owners view join requests"
  ON public.brand_campaign_join_requests
  FOR SELECT
  USING (public.user_owns_brand_campaign(auth.uid(), campaign_id));

CREATE POLICY "Brand owners respond to join requests"
  ON public.brand_campaign_join_requests
  FOR UPDATE
  USING (public.user_owns_brand_campaign(auth.uid(), campaign_id))
  WITH CHECK (public.user_owns_brand_campaign(auth.uid(), campaign_id));

-- Admins
CREATE POLICY "Admins manage join requests"
  ON public.brand_campaign_join_requests
  FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER trg_join_requests_updated_at
  BEFORE UPDATE ON public.brand_campaign_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RPC: brand owner responds to a join request
-- =====================================================
CREATE OR REPLACE FUNCTION public.respond_to_brand_campaign_join_request(
  p_request_id uuid,
  p_approve boolean,
  p_response_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_req record;
  v_owns boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM public.brand_campaign_join_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  SELECT public.user_owns_brand_campaign(v_user, v_req.campaign_id) INTO v_owns;
  IF NOT v_owns THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already responded');
  END IF;

  UPDATE public.brand_campaign_join_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
      response_message = p_response_message,
      responded_at = now(),
      responded_by = v_user,
      updated_at = now()
  WHERE id = p_request_id;

  IF p_approve THEN
    INSERT INTO public.brand_campaign_merchants (campaign_id, merchant_id, status, joined_at)
    VALUES (v_req.campaign_id, v_req.merchant_id, 'active', now())
    ON CONFLICT (campaign_id, merchant_id) DO UPDATE
      SET status = 'active', joined_at = COALESCE(public.brand_campaign_merchants.joined_at, now());
  END IF;

  RETURN jsonb_build_object('success', true, 'approved', p_approve);
END;
$$;

-- =====================================================
-- RPC: list available campaigns a merchant can join
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_available_brand_campaigns(p_merchant_id uuid)
RETURNS TABLE (
  id uuid,
  brand_id uuid,
  name text,
  description text,
  pawbucks_per_checkin integer,
  pawbucks_pool integer,
  budget_usd numeric,
  start_date timestamptz,
  end_date timestamptz,
  campaign_color text,
  campaign_logo_url text,
  targeting_notes text,
  trigger_type text,
  min_purchase_usd numeric,
  status text,
  brand_name text,
  brand_logo_url text,
  brand_description text,
  brand_website_url text,
  existing_request_status text,
  existing_invitation_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.brand_id,
    c.name,
    c.description,
    c.pawbucks_per_checkin,
    c.pawbucks_pool,
    c.budget_usd,
    c.start_date,
    c.end_date,
    c.campaign_color,
    c.campaign_logo_url,
    c.targeting_notes,
    c.trigger_type,
    c.min_purchase_usd,
    c.status,
    ba.brand_name,
    ba.logo_url AS brand_logo_url,
    ba.description AS brand_description,
    ba.website_url AS brand_website_url,
    (SELECT jr.status FROM public.brand_campaign_join_requests jr
       WHERE jr.campaign_id = c.id AND jr.merchant_id = p_merchant_id
       ORDER BY jr.requested_at DESC LIMIT 1) AS existing_request_status,
    (SELECT inv.status FROM public.brand_campaign_invitations inv
       WHERE inv.campaign_id = c.id AND inv.merchant_id = p_merchant_id
       ORDER BY inv.invited_at DESC LIMIT 1) AS existing_invitation_status
  FROM public.brand_campaigns c
  JOIN public.brand_accounts ba ON ba.id = c.brand_id
  WHERE c.status IN ('active','paused')
    AND COALESCE(c.pawbucks_pool, 0) > COALESCE(c.total_distributed, 0)
    AND (c.end_date IS NULL OR c.end_date > now())
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_campaign_merchants bcm
      WHERE bcm.campaign_id = c.id
        AND bcm.merchant_id = p_merchant_id
        AND bcm.status = 'active'
    )
  ORDER BY c.created_at DESC;
$$;
