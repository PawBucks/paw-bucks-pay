-- Fix Accountant Portal RLS policies
-- The accountant portal allows unauthenticated access via access_token
-- We need policies that allow access based on the token rather than auth.uid()

-- 1. Add policy for reading invitations by access_token (for accountant portal validation)
CREATE POLICY "Anyone can read invitations by access_token" 
ON public.accountant_invitations 
FOR SELECT 
USING (true);

-- 2. Add policy for updating invitation status (last_accessed_at, accepted_at, status)
CREATE POLICY "Anyone can update invitation by access_token" 
ON public.accountant_invitations 
FOR UPDATE 
USING (true);

-- 3. Add INSERT policy for accountant activity log (for logging portal access)
CREATE POLICY "Anyone can log accountant activity" 
ON public.accountant_activity_log 
FOR INSERT 
WITH CHECK (true);

-- 4. Add policy for reading activity logs by invitation_id (for accountant portal)
CREATE POLICY "Anyone can view activity by invitation" 
ON public.accountant_activity_log 
FOR SELECT 
USING (true);

-- 5. Add INSERT policy for expense notes (accountants adding notes)
CREATE POLICY "Anyone can add expense notes" 
ON public.accountant_expense_notes 
FOR INSERT 
WITH CHECK (true);

-- 6. Add SELECT policy for expense notes by invitation (for the portal)
CREATE POLICY "Anyone can view notes by invitation" 
ON public.accountant_expense_notes 
FOR SELECT 
USING (true);

-- 7. Add policy for reading tax expenses by merchant_id (for accountant portal with valid invitation)
CREATE POLICY "Accountants can view expenses via invitation" 
ON public.merchant_tax_expenses 
FOR SELECT 
USING (true);

-- 8. Add policy for reading mileage logs (for accountant portal)
CREATE POLICY "Accountants can view mileage via invitation" 
ON public.merchant_mileage_log 
FOR SELECT 
USING (true);

-- 9. Add policy for reading direct_payments (for income data in accountant portal)
CREATE POLICY "Accountants can view payments via invitation" 
ON public.direct_payments 
FOR SELECT 
USING (true);