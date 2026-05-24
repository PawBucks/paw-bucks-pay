
-- Product images: restrict UPDATE/DELETE to folder owner (merchant) or admins
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

CREATE POLICY "Merchants or admins can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.merchants WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.merchants WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  )
);

CREATE POLICY "Merchants or admins can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.merchants WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  )
);

-- Vet imaging: align SELECT with INSERT (folder == partner_vets.id for the auth user)
DROP POLICY IF EXISTS "Users can view their own imaging files" ON storage.objects;

CREATE POLICY "Vets can view their own imaging files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vet-imaging'
  AND EXISTS (
    SELECT 1 FROM public.partner_vets pv
    WHERE pv.user_id = auth.uid()
      AND (storage.foldername(objects.name))[1] = pv.id::text
  )
);
