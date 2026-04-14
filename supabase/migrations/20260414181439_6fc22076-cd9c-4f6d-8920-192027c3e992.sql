-- Drop broad SELECT policies that allow listing all files in public buckets
-- Public buckets still allow direct URL access to files, but listing is now restricted

-- Assets bucket: restrict listing to authenticated users
DROP POLICY IF EXISTS "Public can view assets" ON storage.objects;
CREATE POLICY "Authenticated users can view assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'assets');

-- Lost pet photos: restrict listing to authenticated users
DROP POLICY IF EXISTS "Anyone can view lost pet photos" ON storage.objects;
CREATE POLICY "Authenticated users can view lost pet photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lost-pet-photos');

-- Merchant logos: restrict listing to authenticated users
DROP POLICY IF EXISTS "Anyone can view merchant logos" ON storage.objects;
CREATE POLICY "Authenticated users can view merchant logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'merchant-logos');

-- Pet photos: restrict listing to authenticated users
DROP POLICY IF EXISTS "Users can view pet photos" ON storage.objects;
CREATE POLICY "Authenticated users can view pet photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pet-photos');

-- Policy documents: restrict listing to authenticated users
DROP POLICY IF EXISTS "Anyone can view policy documents" ON storage.objects;
CREATE POLICY "Authenticated users can view policy documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'policy-documents');

-- Review photos: restrict listing to authenticated users
DROP POLICY IF EXISTS "Anyone can view review photos" ON storage.objects;
CREATE POLICY "Authenticated users can view review photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'review-photos');