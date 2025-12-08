-- Force RLS for table owners as well (prevents bypassing RLS even for table owners)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Also ensure the UPDATE policy has proper WITH CHECK clause
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);