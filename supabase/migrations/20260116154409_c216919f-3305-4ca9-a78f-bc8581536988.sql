-- Drop the existing admin policy on merchant_pawbucks_wallet
DROP POLICY IF EXISTS "Admins can view all merchant wallets" ON public.merchant_pawbucks_wallet;

-- Create a new policy that includes both admin and superadmin roles (consistent with pawbucks_wallet)
CREATE POLICY "Admins can view all merchant wallets" 
ON public.merchant_pawbucks_wallet 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin'::app_role, 'superadmin'::app_role)
  )
);