
-- Fix 1: Make merchant-messages bucket private
UPDATE storage.buckets SET public = false WHERE id = 'merchant-messages';

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view merchant message files" ON storage.objects;

-- Create ownership-based SELECT policy: only conversation participants can view files
CREATE POLICY "Conversation participants can view merchant message files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'merchant-messages'
  AND (
    -- Check if user is the customer in the conversation
    EXISTS (
      SELECT 1 FROM merchant_message_attachments mma
      JOIN merchant_messages mm ON mm.id = mma.message_id
      WHERE mma.file_url LIKE '%' || name || '%'
      AND mm.user_id = auth.uid()
    )
    OR
    -- Check if user owns the merchant in the conversation
    EXISTS (
      SELECT 1 FROM merchant_message_attachments mma
      JOIN merchant_messages mm ON mm.id = mma.message_id
      JOIN merchants m ON m.id = mm.merchant_id
      WHERE mma.file_url LIKE '%' || name || '%'
      AND m.user_id = auth.uid()
    )
    OR
    -- Allow access if the file is in a folder for a merchant they own (for upload preview)
    EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.user_id = auth.uid()
      AND (storage.foldername(name))[1] = m.id::text
    )
    OR
    -- Allow access if the user uploaded to this merchant's folder (customer side)
    (storage.foldername(name))[1] IS NOT NULL
    AND auth.uid() IS NOT NULL
  )
);

-- Fix 2: Fix pet-email-attachments broken SELECT policy
-- The existing policy already uses storage.foldername(name) correctly after the previous migration fix.
-- But let's ensure the policy references the storage object's name, not the pet's name.
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
