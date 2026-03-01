CREATE POLICY "Admins can view all pet profiles"
ON public.pet_profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin')
);