DROP POLICY IF EXISTS "Users can view their own imaging files" ON storage.objects;

CREATE POLICY "Users can view their own imaging files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vet-imaging'
  AND (
    -- Vet who owns the folder (folder name = partner_vets.id)
    EXISTS (
      SELECT 1 FROM public.partner_vets pv
      WHERE pv.user_id = auth.uid()
        AND (storage.foldername(storage.objects.name))[1] = pv.id::text
    )
    -- Or pet owner whose user id matches the folder name
    OR (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  )
);