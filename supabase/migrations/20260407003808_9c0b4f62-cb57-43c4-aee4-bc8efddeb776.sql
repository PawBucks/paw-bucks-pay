-- Allow merchants to view receipt submissions for their merchant
CREATE POLICY "Merchants can view their receipt submissions"
ON public.receipt_submissions FOR SELECT
TO authenticated
USING (
  merchant_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM merchants m
    WHERE m.id = receipt_submissions.merchant_id
    AND m.user_id = auth.uid()
  )
);

-- Enable realtime for receipt_submissions
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipt_submissions;