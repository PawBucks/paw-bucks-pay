CREATE POLICY "Public can view merchant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant-logos');