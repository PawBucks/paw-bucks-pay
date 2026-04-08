-- Fix 1: Broken storage policy on pet-email-attachments
-- The current policy references pp.name (pet display name) instead of the storage object name
DROP POLICY IF EXISTS "Pet owners can read email attachments" ON storage.objects;

CREATE POLICY "Pet owners can read email attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pet-email-attachments'
  AND EXISTS (
    SELECT 1 FROM pet_profiles pp
    WHERE (pp.id)::text = (storage.foldername(name))[1]
    AND (pp.user_id = auth.uid() OR is_shared_member_of(pp.user_id))
  )
);

-- Fix 2: Restrict platform_settings to admins only
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.platform_settings;

CREATE POLICY "Admins can view settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role)
);

-- Fix 3: Remove overly broad public SELECT on merchant_service_purchases
-- Merchants and admins already have their own policies
DROP POLICY IF EXISTS "Public can view active service assignments" ON public.merchant_service_purchases;

-- Replace with authenticated-only policy scoped to active assignments
CREATE POLICY "Authenticated can view active service assignments"
ON public.merchant_service_purchases FOR SELECT
TO authenticated
USING (status = 'active' AND (expires_at IS NULL OR expires_at > now()));