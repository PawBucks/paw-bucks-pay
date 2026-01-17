
-- Security Audit January 2026: Fix overly permissive RLS policies
-- This migration tightens security for accountant-related tables and mileage log

-- ============================================
-- 1. Fix merchant_mileage_log policies
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Accountants can view mileage via invitation" ON merchant_mileage_log;

-- Create a proper policy that validates the accountant has a valid invitation for this merchant
CREATE POLICY "Accountants can view mileage via valid invitation" ON merchant_mileage_log
  FOR SELECT
  USING (
    merchant_id IN (
      SELECT ai.merchant_id 
      FROM accountant_invitations ai
      WHERE ai.status = 'accepted' 
        AND ai.expires_at > now()
        AND ai.accountant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================
-- 2. Fix accountant_invitations policies
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can read invitations by access_token" ON accountant_invitations;
DROP POLICY IF EXISTS "Anyone can update invitation by access_token" ON accountant_invitations;

-- Create a database function to validate access tokens securely (for unauthenticated access during acceptance flow)
CREATE OR REPLACE FUNCTION validate_accountant_access_token(token_param text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_id uuid;
BEGIN
  SELECT id INTO invitation_id
  FROM accountant_invitations
  WHERE access_token = token_param
    AND expires_at > now()
    AND status IN ('pending', 'accepted');
  
  RETURN invitation_id;
END;
$$;

-- Authenticated accountants can view their own invitations
CREATE POLICY "Authenticated users can view their invitations" ON accountant_invitations
  FOR SELECT
  USING (
    accountant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Service role can manage invitations (for edge functions handling token-based access)
CREATE POLICY "Service role can manage invitations" ON accountant_invitations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 3. Fix accountant_activity_log policies
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can view activity by invitation" ON accountant_activity_log;
DROP POLICY IF EXISTS "Anyone can log accountant activity" ON accountant_activity_log;

-- Authenticated accountants can view activity logs for their invitations
CREATE POLICY "Accountants can view their activity logs" ON accountant_activity_log
  FOR SELECT
  USING (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND ai.status = 'accepted'
    )
    OR merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Only authenticated accountants with valid invitations can log activity
CREATE POLICY "Accountants can log their own activity" ON accountant_activity_log
  FOR INSERT
  WITH CHECK (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND ai.status = 'accepted'
        AND ai.expires_at > now()
    )
  );

-- Service role can manage activity logs (for edge functions)
CREATE POLICY "Service role can manage activity logs" ON accountant_activity_log
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 4. Fix accountant_expense_notes policies
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can view notes by invitation" ON accountant_expense_notes;
DROP POLICY IF EXISTS "Anyone can add expense notes" ON accountant_expense_notes;

-- Authenticated accountants can view expense notes for their invitations
CREATE POLICY "Accountants can view notes on their assigned expenses" ON accountant_expense_notes
  FOR SELECT
  USING (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND ai.status = 'accepted'
    )
    OR invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    )
  );

-- Only authenticated accountants with valid invitations can add notes
CREATE POLICY "Accountants can add notes to assigned expenses" ON accountant_expense_notes
  FOR INSERT
  WITH CHECK (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND ai.status = 'accepted'
        AND ai.expires_at > now()
    )
  );

-- Accountants can update their own notes
CREATE POLICY "Accountants can update their own notes" ON accountant_expense_notes
  FOR UPDATE
  USING (
    invitation_id IN (
      SELECT ai.id 
      FROM accountant_invitations ai
      WHERE ai.accountant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND ai.status = 'accepted'
    )
  );

-- Service role can manage expense notes (for edge functions)
CREATE POLICY "Service role can manage expense notes" ON accountant_expense_notes
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
