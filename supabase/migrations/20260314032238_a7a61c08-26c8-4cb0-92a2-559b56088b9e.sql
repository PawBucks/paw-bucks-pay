-- Drop and recreate the UPDATE policy with both USING and WITH CHECK
DROP POLICY IF EXISTS "Users can update their own pet profiles" ON public.pet_profiles;

CREATE POLICY "Users can update their own pet profiles" ON public.pet_profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);