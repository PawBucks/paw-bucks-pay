
-- Allow pet owners to read vet-imaging files for their own pets.
-- Imaging records store URLs/paths in image_urls (text[]) and thumbnail_url.
CREATE POLICY "Pet owners can view their pets imaging files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vet-imaging'
  AND EXISTS (
    SELECT 1
    FROM public.pet_imaging_records pir
    JOIN public.pet_profiles p ON p.id = pir.pet_id
    WHERE p.user_id = auth.uid()
      AND (
        pir.thumbnail_url LIKE '%' || storage.objects.name || '%'
        OR array_to_string(pir.image_urls, ',') LIKE '%' || storage.objects.name || '%'
      )
  )
);

-- Allow vets to update their own invoice files
CREATE POLICY "Vets can update their own invoice files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vet-invoices'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'vet-invoices'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow vets to delete their own invoice files
CREATE POLICY "Vets can delete their own invoice files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vet-invoices'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
