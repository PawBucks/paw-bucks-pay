-- Audit fixes: (1) brand_campaigns recursive RLS, (2) auth.users in policies, (3) lost_pet_posts anon PII exposure

-- ============================================================
-- 1. Break recursion between brand_campaigns and brand_campaign_merchants
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_owns_brand_campaign(_user_id uuid, _campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brand_campaigns bc
    JOIN public.brand_accounts ba ON ba.id = bc.brand_id
    WHERE bc.id = _campaign_id AND ba.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_participates_in_campaign(_user_id uuid, _campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brand_campaign_merchants bcm
    JOIN public.merchants m ON m.id = bcm.merchant_id
    WHERE bcm.campaign_id = _campaign_id AND m.user_id = _user_id
  );
$$;

-- Replace recursive policies on brand_campaigns
DROP POLICY IF EXISTS "Merchants can view campaigns they participate in" ON public.brand_campaigns;
CREATE POLICY "Merchants can view campaigns they participate in"
  ON public.brand_campaigns FOR SELECT
  USING (public.user_participates_in_campaign(auth.uid(), id));

-- Replace recursive policies on brand_campaign_merchants
DROP POLICY IF EXISTS "Brand owners can view campaign merchants" ON public.brand_campaign_merchants;
CREATE POLICY "Brand owners can view campaign merchants"
  ON public.brand_campaign_merchants FOR SELECT
  USING (public.user_owns_brand_campaign(auth.uid(), campaign_id));

-- ============================================================
-- 2. Replace auth.users references with get_current_user_email()
-- ============================================================
DROP POLICY IF EXISTS "Owners can view slices for their invoices" ON public.invoice_slices;
CREATE POLICY "Owners can view slices for their invoices"
  ON public.invoice_slices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_slices.invoice_id
      AND inv.client_email = public.get_current_user_email()
  ));

DROP POLICY IF EXISTS "Owners can update recovery option" ON public.invoice_slices;
CREATE POLICY "Owners can update recovery option"
  ON public.invoice_slices FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_slices.invoice_id
      AND inv.client_email = public.get_current_user_email()
  ));

DROP POLICY IF EXISTS "Vets can view codes shared with them" ON public.pet_health_access_codes;
CREATE POLICY "Vets can view codes shared with them"
  ON public.pet_health_access_codes FOR SELECT
  USING (
    vet_email = public.get_current_user_email()
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- ============================================================
-- 3. Remove anonymous PII exposure on lost_pet_posts
-- Anonymous users should use the lost_pet_posts_public view (which masks contact info)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view active lost pet posts" ON public.lost_pet_posts;
-- Authenticated users still get full access via the existing
-- "Authenticated users can view all active lost pet posts" policy.
