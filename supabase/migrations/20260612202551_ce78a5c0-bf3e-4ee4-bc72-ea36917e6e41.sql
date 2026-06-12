
-- assets
DROP POLICY IF EXISTS "Authenticated users can upload assets" ON storage.objects;
CREATE POLICY "Users can upload assets to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- lost-pet-photos
DROP POLICY IF EXISTS "Authenticated users can upload lost pet photos" ON storage.objects;
CREATE POLICY "Users can upload lost pet photos to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lost-pet-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- review-photos
DROP POLICY IF EXISTS "Authenticated users can upload review photos" ON storage.objects;
CREATE POLICY "Users can upload review photos to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'review-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- product-images: must be owning merchant or admin/superadmin
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Merchants or admins can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
);

-- merchant-messages: owning merchant OR existing customer of that merchant
DROP POLICY IF EXISTS "Authenticated users can upload merchant message files" ON storage.objects;
CREATE POLICY "Merchant or customer can upload merchant message files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'merchant-messages'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT m.id::text FROM public.merchants m WHERE m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.merchant_messages mm
      WHERE mm.user_id = auth.uid()
        AND mm.merchant_id::text = (storage.foldername(name))[1]
    )
  )
);
