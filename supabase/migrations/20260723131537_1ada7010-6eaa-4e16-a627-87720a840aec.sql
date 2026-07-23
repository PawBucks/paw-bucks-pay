
DROP POLICY IF EXISTS "Anyone can view service limits" ON public.geo_cell_service_limits;
CREATE POLICY "Authenticated users can view service limits"
  ON public.geo_cell_service_limits FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can read total caps" ON public.geo_cell_service_total_caps;
CREATE POLICY "Authenticated users can read total caps"
  ON public.geo_cell_service_total_caps FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can read global caps" ON public.service_global_caps;
CREATE POLICY "Authenticated users can read global caps"
  ON public.service_global_caps FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can read boost config" ON public.search_boost_config;
CREATE POLICY "Authenticated users can read boost config"
  ON public.search_boost_config FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.geo_cell_service_limits FROM anon;
REVOKE SELECT ON public.geo_cell_service_total_caps FROM anon;
REVOKE SELECT ON public.service_global_caps FROM anon;
REVOKE SELECT ON public.search_boost_config FROM anon;

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.merchant_reviews;
CREATE POLICY "Authenticated users can view reviews"
  ON public.merchant_reviews FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.merchant_reviews FROM anon;
GRANT SELECT ON public.merchant_reviews_public TO anon, authenticated;
