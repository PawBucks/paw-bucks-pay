
CREATE OR REPLACE FUNCTION public.respond_to_brand_campaign_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_inv record;
  v_owns boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_inv FROM public.brand_campaign_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invitation not found'); END IF;
  SELECT EXISTS (SELECT 1 FROM public.merchants WHERE id = v_inv.merchant_id AND user_id = v_user) INTO v_owns;
  IF NOT v_owns THEN RETURN jsonb_build_object('success', false, 'error', 'Not authorized'); END IF;
  IF v_inv.status NOT IN ('pending', 'sent') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already responded');
  END IF;
  UPDATE public.brand_campaign_invitations
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      responded_at = now(), updated_at = now()
  WHERE id = p_invitation_id;
  IF p_accept THEN
    INSERT INTO public.brand_campaign_merchants (campaign_id, merchant_id, status, joined_at)
    VALUES (v_inv.campaign_id, v_inv.merchant_id, 'active', now())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('success', true, 'accepted', p_accept);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_marketplace_merchants(
  p_search text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  business_name text,
  business_type text,
  business_categories text[],
  logo_url text,
  address text,
  description text,
  cashback_rate numeric,
  accepts_pawbucks boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.business_name, m.business_type, m.business_categories,
         m.logo_url, m.address, m.description, m.cashback_rate, m.accepts_pawbucks
  FROM public.merchants m
  WHERE COALESCE(m.onboarding_complete, false) = true
    AND COALESCE(m.accepts_pawbucks, false) = true
    AND (p_search IS NULL OR m.business_name ILIKE '%' || p_search || '%')
    AND (p_category IS NULL OR m.business_type = p_category OR p_category = ANY(COALESCE(m.business_categories, ARRAY[]::text[])))
  ORDER BY m.business_name ASC
  LIMIT p_limit;
$$;

DROP POLICY IF EXISTS "Merchants can view their invitations" ON public.brand_campaign_invitations;
CREATE POLICY "Merchants can view their invitations"
ON public.brand_campaign_invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.merchants WHERE id = brand_campaign_invitations.merchant_id AND user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.brand_campaigns bc
    JOIN public.brand_accounts ba ON ba.id = bc.brand_id
    WHERE bc.id = brand_campaign_invitations.campaign_id AND ba.user_id = auth.uid()
  )
);
