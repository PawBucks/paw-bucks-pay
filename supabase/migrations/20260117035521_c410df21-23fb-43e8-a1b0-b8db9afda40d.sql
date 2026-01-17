-- Fix RLS policies that were incorrectly querying auth.users table
-- Regular users don't have permission to SELECT from auth.users

-- Drop the problematic accountant policy
DROP POLICY IF EXISTS "Accountants can view mileage via valid invitation" ON merchant_mileage_log;

-- Drop and recreate accountant_invitations policies that query auth.users
DROP POLICY IF EXISTS "Authenticated users can view their invitations" ON accountant_invitations;

-- Drop and recreate accountant_activity_log policies
DROP POLICY IF EXISTS "Accountants can view their activity logs" ON accountant_activity_log;
DROP POLICY IF EXISTS "Accountants can log their own activity" ON accountant_activity_log;

-- Drop and recreate accountant_expense_notes policies  
DROP POLICY IF EXISTS "Accountants can view notes on their assigned expenses" ON accountant_expense_notes;
DROP POLICY IF EXISTS "Accountants can add notes to assigned expenses" ON accountant_expense_notes;
DROP POLICY IF EXISTS "Accountants can update their own notes" ON accountant_expense_notes;

-- Create a SECURITY DEFINER function to safely get the current user's email
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_user_email() TO authenticated;

-- Recreate merchant_mileage_log accountant policy using the safe function
CREATE POLICY "Accountants can view mileage via valid invitation" ON merchant_mileage_log
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

-- Recreate accountant_invitations policy
CREATE POLICY "Authenticated users can view their invitations" ON accountant_invitations
  FOR SELECT
  USING (
    accountant_email = public.get_current_user_email()
    OR merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Recreate accountant_activity_log policies
CREATE POLICY "Accountants can view their activity logs" ON accountant_activity_log
  FOR SELECT
  USING (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = public.get_current_user_email()
        AND ai.status = 'accepted'
    )
    OR merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Accountants can log their own activity" ON accountant_activity_log
  FOR INSERT
  WITH CHECK (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = public.get_current_user_email()
        AND ai.status = 'accepted'
        AND ai.expires_at > now()
    )
  );

-- Recreate accountant_expense_notes policies
CREATE POLICY "Accountants can view notes on their assigned expenses" ON accountant_expense_notes
  FOR SELECT
  USING (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = public.get_current_user_email()
        AND ai.status = 'accepted'
    )
    OR invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Accountants can add notes to assigned expenses" ON accountant_expense_notes
  FOR INSERT
  WITH CHECK (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = public.get_current_user_email()
        AND ai.status = 'accepted'
        AND ai.expires_at > now()
    )
  );

CREATE POLICY "Accountants can update their own notes" ON accountant_expense_notes
  FOR UPDATE
  USING (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = public.get_current_user_email()
        AND ai.status = 'accepted'
    )
  );