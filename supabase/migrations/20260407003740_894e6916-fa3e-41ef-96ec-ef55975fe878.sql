-- Make receipts bucket public so getPublicUrl() works
UPDATE storage.buckets SET public = true WHERE id = 'receipts';

-- Add public SELECT policy for the receipts bucket
CREATE POLICY "Receipt images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');