CREATE POLICY "Users can insert own followups"
ON public.checkin_followups FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);