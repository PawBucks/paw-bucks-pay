-- Drop existing restrictive policies on pet_profiles
DROP POLICY IF EXISTS "Users can view their own pet profiles" ON public.pet_profiles;
DROP POLICY IF EXISTS "Users can insert their own pet profiles" ON public.pet_profiles;
DROP POLICY IF EXISTS "Users can update their own pet profiles" ON public.pet_profiles;
DROP POLICY IF EXISTS "Users can delete their own pet profiles" ON public.pet_profiles;
DROP POLICY IF EXISTS "Vets can view their patients' pet profiles" ON public.pet_profiles;

-- Recreate as PERMISSIVE policies (default, uses OR logic - any one policy passing grants access)
CREATE POLICY "Users can view their own pet profiles"
ON public.pet_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pet profiles"
ON public.pet_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pet profiles"
ON public.pet_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pet profiles"
ON public.pet_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Vets can view their patients pet profiles"
ON public.pet_profiles
FOR SELECT
TO authenticated
USING (id IN (
  SELECT DISTINCT vet_messages.pet_id
  FROM vet_messages
  WHERE vet_messages.vet_id IN (
    SELECT partner_vets.id
    FROM partner_vets
    WHERE partner_vets.user_id = auth.uid()
  )
));