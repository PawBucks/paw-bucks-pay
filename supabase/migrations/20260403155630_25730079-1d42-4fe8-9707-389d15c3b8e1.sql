-- Fix: Accountants should only access direct_payments after accepting invitation
DROP POLICY IF EXISTS "Accountants can view merchant payments via valid invitation" ON public.direct_payments;

CREATE POLICY "Accountants can view merchant payments via accepted invitation"
ON public.direct_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM accountant_invitations ai
    JOIN merchants m ON m.id = ai.merchant_id
    WHERE m.id = direct_payments.merchant_id
      AND ai.accountant_email = get_current_user_email()
      AND ai.status = 'accepted'
      AND ai.expires_at > now()
  )
);
