-- ============================================================
-- Merchant PawBucks Acceptance Cap
-- Lets merchants/vets cap how much of a transaction's subtotal a
-- customer can pay using PawBucks. Optional. When disabled, no cap.
-- ============================================================

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS pawbucks_cap_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pawbucks_cap_pct integer,
  ADD COLUMN IF NOT EXISTS pawbucks_promo_cap_pct integer,
  ADD COLUMN IF NOT EXISTS pawbucks_promo_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS pawbucks_promo_ends_at timestamptz;

COMMENT ON COLUMN public.merchants.pawbucks_cap_enabled IS 'When true, customers can only redeem PawBucks up to pawbucks_cap_pct of the subtotal. When false, no cap is applied.';
COMMENT ON COLUMN public.merchants.pawbucks_cap_pct IS 'Base cap as a whole percent. Allowed values: 10, 20, 30.';
COMMENT ON COLUMN public.merchants.pawbucks_promo_cap_pct IS 'Temporary boosted cap percent active between promo_starts_at and promo_ends_at. Hard ceiling 50.';

-- Validation trigger (use trigger, not CHECK, so time-based promo bounds stay flexible)
CREATE OR REPLACE FUNCTION public.validate_merchant_pawbucks_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pawbucks_cap_pct IS NOT NULL AND NEW.pawbucks_cap_pct NOT IN (10, 20, 30) THEN
    RAISE EXCEPTION 'pawbucks_cap_pct must be 10, 20, or 30';
  END IF;

  IF NEW.pawbucks_promo_cap_pct IS NOT NULL THEN
    IF NEW.pawbucks_promo_cap_pct < 10 OR NEW.pawbucks_promo_cap_pct > 50 THEN
      RAISE EXCEPTION 'pawbucks_promo_cap_pct must be between 10 and 50';
    END IF;
    IF NEW.pawbucks_promo_starts_at IS NULL OR NEW.pawbucks_promo_ends_at IS NULL THEN
      RAISE EXCEPTION 'Promo cap requires both start and end timestamps';
    END IF;
    IF NEW.pawbucks_promo_starts_at >= NEW.pawbucks_promo_ends_at THEN
      RAISE EXCEPTION 'Promo start must be before promo end';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_merchant_pawbucks_cap ON public.merchants;
CREATE TRIGGER trg_validate_merchant_pawbucks_cap
  BEFORE INSERT OR UPDATE OF pawbucks_cap_pct, pawbucks_promo_cap_pct, pawbucks_promo_starts_at, pawbucks_promo_ends_at
  ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_merchant_pawbucks_cap();

-- Type-based defaults helper
CREATE OR REPLACE FUNCTION public.default_pawbucks_cap_pct(p_business_type text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_business_type IN ('veterinary') THEN 10
    WHEN p_business_type IN ('pet_store', 'food', 'delivery', 'insurance') THEN 20
    WHEN p_business_type IN ('grooming','mobile_groomer','boarding','training','walker','daycare','sitter','photography','hiker','runner','masseuse','behaviorist','breeder','rescue_nonprofit') THEN 30
    ELSE 20
  END;
$$;

-- Effective cap resolver (returns NULL when feature disabled)
CREATE OR REPLACE FUNCTION public.get_effective_pawbucks_cap_pct(p_merchant_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  now_ts timestamptz := now();
BEGIN
  SELECT pawbucks_cap_enabled, pawbucks_cap_pct, business_type,
         pawbucks_promo_cap_pct, pawbucks_promo_starts_at, pawbucks_promo_ends_at
    INTO m
    FROM public.merchants
   WHERE id = p_merchant_id;

  IF NOT FOUND OR NOT m.pawbucks_cap_enabled THEN
    RETURN NULL;
  END IF;

  IF m.pawbucks_promo_cap_pct IS NOT NULL
     AND m.pawbucks_promo_starts_at IS NOT NULL
     AND m.pawbucks_promo_ends_at IS NOT NULL
     AND now_ts >= m.pawbucks_promo_starts_at
     AND now_ts <  m.pawbucks_promo_ends_at THEN
    RETURN m.pawbucks_promo_cap_pct;
  END IF;

  RETURN COALESCE(m.pawbucks_cap_pct, public.default_pawbucks_cap_pct(m.business_type));
END;
$$;

-- Expose cap fields on the public secure view (non-sensitive)
DO $$
DECLARE
  view_def text;
BEGIN
  SELECT pg_get_viewdef('public.merchants_public'::regclass, true) INTO view_def;
  -- Recreate the view with the additional columns appended
  EXECUTE format($f$
    CREATE OR REPLACE VIEW public.merchants_public
    WITH (security_invoker = true) AS
    SELECT
      m.id, m.business_name, m.business_type, m.business_categories,
      m.description, m.logo_url, m.address, m.phone, m.latitude, m.longitude,
      m.cashback_rate, m.accepts_pawbucks, m.price_range, m.is_sponsored,
      m.sponsored_until, m.facebook_url, m.instagram_url, m.twitter_url,
      m.linkedin_url, m.website_url, m.tos_url, m.privacy_policy_url,
      m.shipping_returns_policy_url, m.storefront_slug,
      m.pawbucks_cap_enabled,
      m.pawbucks_cap_pct,
      m.pawbucks_promo_cap_pct,
      m.pawbucks_promo_starts_at,
      m.pawbucks_promo_ends_at
    FROM public.merchants m;
  $f$);
END $$;

GRANT SELECT ON public.merchants_public TO anon, authenticated;