
-- Restrict grooming_breed_profiles SELECT to merchant owners only (no cross-merchant exposure)
DROP POLICY IF EXISTS "Authenticated users can view grooming breed profiles" ON public.grooming_breed_profiles;
CREATE POLICY "Merchant owners can view their breed profiles"
  ON public.grooming_breed_profiles
  FOR SELECT
  TO authenticated
  USING (public.user_owns_merchant(merchant_id));

-- Restrict merchant_reviews SELECT to authenticated users (use merchant_reviews_public view for anon)
DROP POLICY IF EXISTS "Everyone can view reviews" ON public.merchant_reviews;
CREATE POLICY "Authenticated users can view reviews"
  ON public.merchant_reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- Enforce https:// for merchant_webhooks.url (SSRF hardening)
ALTER TABLE public.merchant_webhooks
  DROP CONSTRAINT IF EXISTS merchant_webhooks_url_https_check;
ALTER TABLE public.merchant_webhooks
  ADD CONSTRAINT merchant_webhooks_url_https_check
  CHECK (url ~* '^https://');
