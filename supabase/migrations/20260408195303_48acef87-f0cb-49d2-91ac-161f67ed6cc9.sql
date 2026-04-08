-- Allow admins and superadmins to view all check-ins
CREATE POLICY "Admins can view all check-ins"
ON public.checkins
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
);