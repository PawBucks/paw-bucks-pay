DROP POLICY IF EXISTS "Conversation participants can view merchant message files" ON storage.objects;

CREATE POLICY "Conversation participants can view merchant message files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'merchant-messages'
  AND (
    EXISTS (
      SELECT 1
      FROM merchant_message_attachments mma
      JOIN merchant_messages mm ON mm.id = mma.message_id
      WHERE mma.file_url LIKE ('%' || objects.name || '%')
        AND mm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM merchant_message_attachments mma
      JOIN merchant_messages mm ON mm.id = mma.message_id
      JOIN merchants m ON m.id = mm.merchant_id
      WHERE mma.file_url LIKE ('%' || objects.name || '%')
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM merchants m
      WHERE m.user_id = auth.uid()
        AND (storage.foldername(objects.name))[1] = m.id::text
    )
  )
);