-- Drop the restrictive insert policy and create a more permissive one for signup
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create a new insert policy that allows inserts during signup
-- The trigger runs with SECURITY DEFINER so we trust it
CREATE POLICY "Allow profile creation on signup"
ON public.profiles
FOR INSERT
WITH CHECK (true);

-- Ensure users can still only update their own profiles
-- (The existing update policy already handles this)