CREATE POLICY "Users can insert own provisional checkin activity"
ON public.pawbucks_activity
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND type = 'earn'
  AND source = 'checkin_provisional'
  AND pawbucks_status = 'pending'
  AND amount > 0
);