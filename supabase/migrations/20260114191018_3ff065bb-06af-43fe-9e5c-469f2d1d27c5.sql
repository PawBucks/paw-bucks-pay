-- Allow merchants to view profiles of customers who have transacted with them
CREATE POLICY "Merchants can view customer profiles from transactions"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM transactions t
    JOIN merchants m ON t.merchant_id = m.id
    WHERE t.user_id = profiles.id
    AND m.user_id = auth.uid()
  )
);