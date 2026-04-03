-- Fix 1: Remove the overly permissive public SELECT policy on partner_vets
-- This policy exposed ALL columns (tax_id, npi_number, stripe_account_id, etc.) to anon/authenticated users
DROP POLICY IF EXISTS "Approved vets are publicly viewable" ON public.partner_vets;

-- Replace with a restrictive policy that blocks direct table reads for non-owners
-- Public reads should go through partner_vets_public view (which only exposes safe columns)
CREATE POLICY "Approved vets viewable through view only"
ON public.partner_vets FOR SELECT
TO anon, authenticated
USING (false);

-- Fix 2: Tighten vet-imaging storage bucket SELECT policy
-- Currently any partner vet can read ALL imaging files regardless of patient relationship
DROP POLICY IF EXISTS "Users can view their pet imaging files" ON storage.objects;

-- New policy: vets can only access files in their own folder (vet_id prefix)
-- Pet owners can access files in their own folder (user_id prefix)
CREATE POLICY "Users can view their own imaging files"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'vet-imaging'
  AND (
    -- Vets can only access files under their own vet ID folder
    EXISTS (
      SELECT 1 FROM partner_vets pv
      WHERE pv.user_id = auth.uid()
      AND (storage.foldername(name))[1] = pv.id::text
    )
    -- Users can access files in their own user ID folder
    OR (auth.uid())::text = (storage.foldername(name))[1]
  )
);