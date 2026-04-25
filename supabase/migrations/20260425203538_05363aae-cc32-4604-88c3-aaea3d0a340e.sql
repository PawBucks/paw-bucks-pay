CREATE POLICY "Merchants can view receipts submitted to them"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1
    FROM public.receipt_submissions rs
    JOIN public.merchants m ON m.id = rs.merchant_id
    WHERE m.user_id = auth.uid()
      AND (
        rs.receipt_image_url = storage.objects.name
        OR rs.receipt_image_url = 'receipts/' || storage.objects.name
        OR rs.receipt_image_url LIKE '%/receipts/' || storage.objects.name
      )
  )
);