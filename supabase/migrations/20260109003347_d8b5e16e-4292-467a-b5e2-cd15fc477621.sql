-- Update budget_settings RLS to allow shared account members to view/edit owner's budgets
DROP POLICY IF EXISTS "Users can view their own budget settings" ON public.budget_settings;
DROP POLICY IF EXISTS "Users can insert their own budget settings" ON public.budget_settings;
DROP POLICY IF EXISTS "Users can update their own budget settings" ON public.budget_settings;
DROP POLICY IF EXISTS "Users can delete their own budget settings" ON public.budget_settings;

-- SELECT: Allow viewing own or shared account owner's budgets
CREATE POLICY "Users can view budget settings" 
ON public.budget_settings 
FOR SELECT 
USING (auth.uid() = user_id OR public.is_shared_member_of(user_id));

-- INSERT: Allow inserting for own or shared account owner's budgets
CREATE POLICY "Users can insert budget settings" 
ON public.budget_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR public.is_shared_member_of(user_id));

-- UPDATE: Allow updating own or shared account owner's budgets
CREATE POLICY "Users can update budget settings" 
ON public.budget_settings 
FOR UPDATE 
USING (auth.uid() = user_id OR public.is_shared_member_of(user_id));

-- DELETE: Allow deleting own or shared account owner's budgets
CREATE POLICY "Users can delete budget settings" 
ON public.budget_settings 
FOR DELETE 
USING (auth.uid() = user_id OR public.is_shared_member_of(user_id));