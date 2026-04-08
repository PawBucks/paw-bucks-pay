
-- Fix 1: Receipts bucket - replace public SELECT with owner-scoped policy
DROP POLICY IF EXISTS "Receipts are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;

-- Find and drop any SELECT policy on receipts bucket for public role
-- Create owner-scoped + admin read policy
CREATE POLICY "Users can view own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.is_superadmin(auth.uid())
  )
);

-- Fix 2: Geo cell waitlist - remove overly broad SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view waitlist" ON public.geo_cell_waitlist;
