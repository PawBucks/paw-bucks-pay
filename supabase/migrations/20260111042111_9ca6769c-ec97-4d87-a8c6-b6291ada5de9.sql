-- Add policy to allow admins to view all pawbucks_activity
CREATE POLICY "Admins can view all pawbucks activity"
ON public.pawbucks_activity
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);