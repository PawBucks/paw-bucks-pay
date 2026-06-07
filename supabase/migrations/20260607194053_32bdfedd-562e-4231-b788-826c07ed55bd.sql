CREATE POLICY "Merchants upload own intro video"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'merchant-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Merchants update own intro video"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'merchant-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Merchants delete own intro video"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'merchant-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view intro videos"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'merchant-videos');