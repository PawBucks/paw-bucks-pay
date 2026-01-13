-- Add RLS policy for admins to view all pawbucks_wallet records
CREATE POLICY "Admins can view all wallets"
ON public.pawbucks_wallet
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'superadmin')
  )
);