-- Create a function to check if a user is a shared member who can access the owner's data
CREATE OR REPLACE FUNCTION public.is_shared_member_of(owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shared_account_members
    WHERE member_id = auth.uid()
    AND owner_id = owner_user_id
    AND status = 'accepted'
  )
$$;

-- Update pawbucks_wallet policy to allow shared members
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.pawbucks_wallet;
CREATE POLICY "Users can view their own or shared wallet" 
ON public.pawbucks_wallet 
FOR SELECT 
USING (auth.uid() = user_id OR is_shared_member_of(user_id));

-- Update pawbucks_activity policy to allow shared members
DROP POLICY IF EXISTS "Users can view their own activity" ON public.pawbucks_activity;
CREATE POLICY "Users can view their own or shared activity" 
ON public.pawbucks_activity 
FOR SELECT 
USING (auth.uid() = user_id OR is_shared_member_of(user_id));

-- Update wallets policy to allow shared members
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
CREATE POLICY "Users can view their own or shared wallet" 
ON public.wallets 
FOR SELECT 
USING (auth.uid() = user_id OR is_shared_member_of(user_id));

-- Update transactions policy for shared members (keep existing policies, add new one)
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own or shared transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id OR is_shared_member_of(user_id));

-- Update pet_profiles policy for shared members
DROP POLICY IF EXISTS "Users can view their own pet profiles" ON public.pet_profiles;
CREATE POLICY "Users can view their own or shared pet profiles" 
ON public.pet_profiles 
FOR SELECT 
USING (auth.uid() = user_id OR is_shared_member_of(user_id));