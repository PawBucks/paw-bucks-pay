GRANT INSERT ON public.partner_vets TO authenticated;
GRANT ALL ON public.partner_vets TO service_role;

DROP POLICY IF EXISTS "Vets can create their own record" ON public.partner_vets;
CREATE POLICY "Vets can create their own record"
ON public.partner_vets
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(is_verified, false) = false
  AND COALESCE(approval_status, 'pending') = 'pending'
  AND approved_at IS NULL
  AND approved_by IS NULL
);