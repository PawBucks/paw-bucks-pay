DROP POLICY IF EXISTS "Vets can upload imaging files" ON storage.objects;

CREATE POLICY "Vets can upload imaging files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vet-imaging'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM public.partner_vets WHERE user_id = auth.uid() LIMIT 1
  )
);