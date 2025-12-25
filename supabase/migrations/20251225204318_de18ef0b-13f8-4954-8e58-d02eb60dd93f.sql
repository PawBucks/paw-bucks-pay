-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

-- Create a new INSERT policy that allows both admin and superadmin roles
CREATE POLICY "Admins and superadmins can insert notifications"
ON public.notifications
FOR INSERT
TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role)
);