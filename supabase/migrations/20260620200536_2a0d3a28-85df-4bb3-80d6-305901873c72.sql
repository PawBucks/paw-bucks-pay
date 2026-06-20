-- Revert security_invoker on views that are intended to be publicly readable.
-- These views intentionally expose only safe columns from underlying tables
-- whose RLS restricts row access to owners/admins. Switching them to
-- security_invoker broke pet-owner UIs (e.g. transaction list showed
-- "Pet care" instead of merchant names) because callers can't read the
-- underlying tables directly.
ALTER VIEW public.merchants_public SET (security_invoker = off);
ALTER VIEW public.partner_vets_public SET (security_invoker = off);
ALTER VIEW public.merchant_active_services_public SET (security_invoker = off);
ALTER VIEW public.founding_50_badges_public SET (security_invoker = off);
ALTER VIEW public.reviewer_profiles SET (security_invoker = off);

-- Keep merchant_twilio_settings_safe as security_invoker — sensitive,
-- not meant for general public access.