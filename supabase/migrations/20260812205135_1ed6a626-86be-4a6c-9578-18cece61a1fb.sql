DROP POLICY IF EXISTS "Merchants can update their own logo" ON storage.objects;
CREATE POLICY "Merchants can update their own logo"
ON storage.objects FOR UPDATE
USING (bucket_id = 'merchant-logos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'merchant-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Public can view merchant logos" ON storage.objects;
CREATE POLICY "Public can view merchant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant-logos');