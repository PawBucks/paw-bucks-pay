
-- Remove all remaining public/overly-broad SELECT policies on receipts
DROP POLICY IF EXISTS "Receipt images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;

-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'receipts';
