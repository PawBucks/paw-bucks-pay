
-- 1. Add business profile fields to brand_accounts
ALTER TABLE public.brand_accounts
  ADD COLUMN IF NOT EXISTS legal_business_name text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS year_founded integer,
  ADD COLUMN IF NOT EXISTS industry_category text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_title text,
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_contact_email text,
  ADD COLUMN IF NOT EXISTS billing_contact_phone text,
  ADD COLUMN IF NOT EXISTS marketing_preferences jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- 2. Admin: delete brand account (cascades campaigns via FK)
CREATE OR REPLACE FUNCTION public.admin_delete_brand_account(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_is_admin boolean;
  v_brand record;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin AND role IN ('admin','superadmin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT * INTO v_brand FROM public.brand_accounts WHERE id = p_brand_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Brand not found');
  END IF;

  -- Delete dependent campaigns explicitly (cascade may not be set everywhere)
  DELETE FROM public.brand_campaigns WHERE brand_id = p_brand_id;
  DELETE FROM public.brand_accounts WHERE id = p_brand_id;

  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin,
    'DELETE_BRAND_ACCOUNT',
    'brand_account',
    p_brand_id,
    jsonb_build_object('brand_name', v_brand.brand_name, 'contact_email', v_brand.contact_email)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Brand: submit full setup form (claims account if needed and marks complete)
CREATE OR REPLACE FUNCTION public.complete_brand_setup(p_brand_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_brand record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_brand FROM public.brand_accounts WHERE id = p_brand_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Brand not found');
  END IF;

  IF v_brand.user_id IS NOT NULL AND v_brand.user_id <> v_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have access to this brand account');
  END IF;

  UPDATE public.brand_accounts SET
    user_id = COALESCE(user_id, v_user),
    invitation_claimed_at = COALESCE(invitation_claimed_at, now()),
    legal_business_name  = COALESCE(p_payload->>'legal_business_name', legal_business_name),
    business_type        = COALESCE(p_payload->>'business_type', business_type),
    tax_id               = COALESCE(p_payload->>'tax_id', tax_id),
    year_founded         = COALESCE(NULLIF(p_payload->>'year_founded','')::int, year_founded),
    industry_category    = COALESCE(p_payload->>'industry_category', industry_category),
    company_size         = COALESCE(p_payload->>'company_size', company_size),
    description          = COALESCE(p_payload->>'description', description),
    website_url          = COALESCE(p_payload->>'website_url', website_url),
    logo_url             = COALESCE(p_payload->>'logo_url', logo_url),
    address_line1        = COALESCE(p_payload->>'address_line1', address_line1),
    address_line2        = COALESCE(p_payload->>'address_line2', address_line2),
    city                 = COALESCE(p_payload->>'city', city),
    state                = COALESCE(p_payload->>'state', state),
    postal_code          = COALESCE(p_payload->>'postal_code', postal_code),
    country              = COALESCE(p_payload->>'country', country),
    contact_name         = COALESCE(p_payload->>'contact_name', contact_name),
    contact_email        = COALESCE(p_payload->>'contact_email', contact_email),
    contact_phone        = COALESCE(p_payload->>'contact_phone', contact_phone),
    contact_title        = COALESCE(p_payload->>'contact_title', contact_title),
    billing_contact_name  = COALESCE(p_payload->>'billing_contact_name', billing_contact_name),
    billing_contact_email = COALESCE(p_payload->>'billing_contact_email', billing_contact_email),
    billing_contact_phone = COALESCE(p_payload->>'billing_contact_phone', billing_contact_phone),
    marketing_preferences = COALESCE(p_payload->'marketing_preferences', marketing_preferences),
    social_links          = COALESCE(p_payload->'social_links', social_links),
    terms_accepted_at     = CASE WHEN (p_payload->>'terms_accepted')::boolean THEN now() ELSE terms_accepted_at END,
    setup_completed_at    = now(),
    status                = 'active',
    updated_at            = now()
  WHERE id = p_brand_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. RLS: ensure the claimed brand owner can read/update their own account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'brand_accounts' AND policyname = 'Brand owners can view their account'
  ) THEN
    CREATE POLICY "Brand owners can view their account"
      ON public.brand_accounts FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
