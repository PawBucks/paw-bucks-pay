CREATE POLICY "Admins can view all pet fund ledgers"
ON public.pet_fund_ledgers FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can view all pet fund releases"
ON public.pet_fund_releases FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));