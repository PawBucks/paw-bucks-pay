
-- =========================================================
-- SECURITY FIX PART 1: Fix direct_payments overly permissive policy
-- =========================================================

-- The policy "Accountants can view payments via invitation" with USING(true) allows ANYONE to view ALL payments
DROP POLICY IF EXISTS "Accountants can view payments via invitation" ON public.direct_payments;

-- Create proper accountant access policy that validates the accountant invitation
CREATE POLICY "Accountants can view merchant payments via valid invitation"
  ON public.direct_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM accountant_invitations ai
      JOIN merchants m ON m.id = ai.merchant_id
      WHERE m.id = direct_payments.merchant_id
        AND ai.accountant_email = public.get_current_user_email()
        AND ai.status IN ('pending', 'accepted')
        AND ai.expires_at > now()
    )
  );
