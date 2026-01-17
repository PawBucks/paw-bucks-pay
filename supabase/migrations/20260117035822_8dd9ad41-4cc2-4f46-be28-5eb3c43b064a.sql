-- Fix overly permissive accountant policy on merchant_tax_expenses
-- The current policy has "USING (true)" which allows anyone to read all expenses

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Accountants can view expenses via invitation" ON merchant_tax_expenses;

-- Create a proper policy that validates the accountant has a valid invitation
CREATE POLICY "Accountants can view expenses via valid invitation" ON merchant_tax_expenses
  FOR SELECT
  USING (
    merchant_id IN (
      SELECT ai.merchant_id 
      FROM accountant_invitations ai
      WHERE ai.status = 'accepted' 
        AND ai.expires_at > now()
        AND ai.accountant_email = public.get_current_user_email()
    )
  );

-- Also add accountant view policy for vehicle expenses (for completeness)
CREATE POLICY "Accountants can view vehicle expenses via valid invitation" ON merchant_vehicle_expenses
  FOR SELECT
  USING (
    merchant_id IN (
      SELECT ai.merchant_id 
      FROM accountant_invitations ai
      WHERE ai.status = 'accepted' 
        AND ai.expires_at > now()
        AND ai.accountant_email = public.get_current_user_email()
    )
  );