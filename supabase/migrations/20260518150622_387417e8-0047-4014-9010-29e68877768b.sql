CREATE POLICY "Merchants can view transacting customer profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    JOIN public.merchants m ON m.id = t.merchant_id
    WHERE t.user_id = profiles.id
      AND m.user_id = auth.uid()
  )
);