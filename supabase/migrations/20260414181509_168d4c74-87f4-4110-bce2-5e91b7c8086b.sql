-- Public buckets serve files via direct URL without needing SELECT policies
-- Remove SELECT policies to prevent file enumeration via the storage API

DROP POLICY IF EXISTS "Authenticated users can view assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view lost pet photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view merchant logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view pet photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view policy documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view review photos" ON storage.objects;