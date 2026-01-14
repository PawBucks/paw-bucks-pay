-- Allow admins and superadmins to view all shared account members
CREATE POLICY "Admins can view all shared members"
ON public.shared_account_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);