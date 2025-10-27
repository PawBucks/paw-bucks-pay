-- Fix transaction INSERT policy to prevent fraud
-- Only allow service role (backend/edge functions) to create transactions
-- This prevents users from creating fraudulent transactions directly

-- Drop existing permissive policy
DROP POLICY IF EXISTS "System can create transactions" ON public.transactions;

-- Create new restrictive policy that only allows service role
-- Edge functions use the service role key, so they can still create transactions
-- But regular users cannot directly insert transaction records
CREATE POLICY "Only service role can create transactions"
ON public.transactions
FOR INSERT
WITH CHECK (
  auth.jwt()->>'role' = 'service_role'
);

-- Add comment for documentation
COMMENT ON POLICY "Only service role can create transactions" ON public.transactions IS 
'Restricts transaction creation to backend/edge functions only. Prevents users from creating fraudulent transactions with fake cashback.';
