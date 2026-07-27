
-- Helper: check if current caller is admin/superadmin/service role
CREATE OR REPLACE FUNCTION public.is_admin_or_service()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL THEN
    -- No JWT (service context via definer chain) — allow
    RETURN true;
  END IF;
  RETURN public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'superadmin'::app_role);
END;
$$;

-- ============ merchants ============
CREATE OR REPLACE FUNCTION public.merchants_block_privileged_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_or_service() THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.denial_reason IS DISTINCT FROM OLD.denial_reason
     OR NEW.is_sponsored IS DISTINCT FROM OLD.is_sponsored
     OR NEW.sponsored_until IS DISTINCT FROM OLD.sponsored_until
     OR NEW.cashback_rate IS DISTINCT FROM OLD.cashback_rate
     OR NEW.fee_model IS DISTINCT FROM OLD.fee_model
     OR NEW.stripe_account_status IS DISTINCT FROM OLD.stripe_account_status
     OR NEW.acquisition_fee_rate IS DISTINCT FROM OLD.acquisition_fee_rate
     OR NEW.pawbucks_cap_pct IS DISTINCT FROM OLD.pawbucks_cap_pct
     OR NEW.pawbucks_promo_cap_pct IS DISTINCT FROM OLD.pawbucks_promo_cap_pct
     OR NEW.pawbucks_promo_starts_at IS DISTINCT FROM OLD.pawbucks_promo_starts_at
     OR NEW.pawbucks_promo_ends_at IS DISTINCT FROM OLD.pawbucks_promo_ends_at
     OR NEW.is_paused IS DISTINCT FROM OLD.is_paused
     OR NEW.paused_at IS DISTINCT FROM OLD.paused_at
     OR NEW.paused_by IS DISTINCT FROM OLD.paused_by
     OR NEW.pause_reason IS DISTINCT FROM OLD.pause_reason
     OR NEW.funding_status IS DISTINCT FROM OLD.funding_status
  THEN
    RAISE EXCEPTION 'Not authorized to modify admin-controlled merchant fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merchants_block_privileged_self_update ON public.merchants;
CREATE TRIGGER trg_merchants_block_privileged_self_update
BEFORE UPDATE ON public.merchants
FOR EACH ROW EXECUTE FUNCTION public.merchants_block_privileged_self_update();

-- ============ partner_vets ============
CREATE OR REPLACE FUNCTION public.partner_vets_block_privileged_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_or_service() THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.denial_reason IS DISTINCT FROM OLD.denial_reason
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_connect_account_id IS DISTINCT FROM OLD.stripe_connect_account_id
  THEN
    RAISE EXCEPTION 'Not authorized to modify admin-controlled vet fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_vets_block_privileged_self_update ON public.partner_vets;
CREATE TRIGGER trg_partner_vets_block_privileged_self_update
BEFORE UPDATE ON public.partner_vets
FOR EACH ROW EXECUTE FUNCTION public.partner_vets_block_privileged_self_update();

-- ============ brand_accounts ============
CREATE OR REPLACE FUNCTION public.brand_accounts_block_privileged_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_or_service() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Not authorized to modify brand account status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brand_accounts_block_privileged_self_update ON public.brand_accounts;
CREATE TRIGGER trg_brand_accounts_block_privileged_self_update
BEFORE UPDATE ON public.brand_accounts
FOR EACH ROW EXECUTE FUNCTION public.brand_accounts_block_privileged_self_update();
