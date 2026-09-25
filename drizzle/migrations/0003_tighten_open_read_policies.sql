-- Community: signed-in, non-banned users only
DROP POLICY IF EXISTS "Authenticated can read posts" ON public.community_posts;
CREATE POLICY "Active members can read posts" ON public.community_posts FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_user_banned(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can read comments" ON public.community_comments;
CREATE POLICY "Active members can read comments" ON public.community_comments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_user_banned(auth.uid()));
DROP POLICY IF EXISTS "Authenticated read likes" ON public.community_likes;
CREATE POLICY "Active members can read likes" ON public.community_likes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_user_banned(auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can view reviews" ON public.merchant_reviews;
CREATE POLICY "Active members can view reviews" ON public.merchant_reviews FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_user_banned(auth.uid()));

-- Internal capacity/boost config: admins only (server functions use service role)
DROP POLICY IF EXISTS "Authenticated users can read boost config" ON public.search_boost_config;
CREATE POLICY "Admins can read boost config" ON public.search_boost_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
DROP POLICY IF EXISTS "Authenticated users can read global caps" ON public.service_global_caps;
CREATE POLICY "Admins can read global caps" ON public.service_global_caps FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
DROP POLICY IF EXISTS "Authenticated users can read total caps" ON public.geo_cell_service_total_caps;
CREATE POLICY "Admins can read total caps" ON public.geo_cell_service_total_caps FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- Merchant logos: bucket is public (URLs still work); stop anonymous file listing
DROP POLICY IF EXISTS "Public can view merchant logos" ON storage.objects;
CREATE POLICY "Owners can list their merchant logos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'merchant-logos' AND owner_id = (select auth.uid()::text));

-- Vet imaging uploads: bind to uploader as well as vet folder
DROP POLICY IF EXISTS "Vets can upload imaging files" ON storage.objects;
CREATE POLICY "Vets can upload imaging files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vet-imaging'
    AND owner_id = (select auth.uid()::text)
    AND (storage.foldername(name))[1] IN (SELECT pv.id::text FROM public.partner_vets pv WHERE pv.user_id = auth.uid())
  );