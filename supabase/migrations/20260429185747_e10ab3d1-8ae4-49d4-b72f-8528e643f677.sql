CREATE OR REPLACE VIEW public.merchants_public
WITH (security_invoker = false) AS
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
FROM public.merchants m
WHERE m.approval_status = 'approved';

GRANT SELECT ON public.merchants_public TO anon, authenticated;