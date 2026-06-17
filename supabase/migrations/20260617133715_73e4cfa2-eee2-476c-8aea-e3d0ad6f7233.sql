DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public AS
SELECT id, user_id, business_name, business_type, business_categories, description,
  logo_url, address, phone, email, contact_person, owner_name,
  latitude, longitude, cashback_rate, accepts_pawbucks, price_range, is_sponsored,
  sponsored_until, facebook_url, instagram_url, twitter_url, linkedin_url, website_url,
  tos_url, privacy_policy_url, shipping_returns_policy_url, storefront_slug,
  pawbucks_cap_enabled, pawbucks_cap_pct, pawbucks_promo_cap_pct,
  pawbucks_promo_starts_at, pawbucks_promo_ends_at, search_keywords,
  service_area_radius_miles, country, state_of_incorporation, timezone, working_style,
  entity_type, accepts_welcome_credit, welcome_credit_opted_in_at, is_paused,
  approval_status, stripe_account_status, onboarding_complete, intro_video_url,
  fee_model,
  created_at, updated_at
FROM public.merchants
WHERE approval_status = 'approved'::approval_status;

GRANT SELECT ON public.merchants_public TO anon, authenticated;