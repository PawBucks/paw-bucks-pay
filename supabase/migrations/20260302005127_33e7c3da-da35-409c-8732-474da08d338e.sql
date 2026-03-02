CREATE POLICY "Admins can view all wallets"
ON public.wallets
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin')
);