-- Fix infinite recursion in partner_vets policies
-- The issue is that partner_vets policies reference themselves

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view vets they have relationships with" ON public.partner_vets;
DROP POLICY IF EXISTS "Vets can view their own record" ON public.partner_vets;
DROP POLICY IF EXISTS "Admins can view all partner vets" ON public.partner_vets;
DROP POLICY IF EXISTS "Admins can manage partner vets" ON public.partner_vets;

-- Create a security definer function to safely check vet relationships
CREATE OR REPLACE FUNCTION public.get_user_vet_ids(check_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT vet_id FROM vet_messages WHERE user_id = check_user_id
  UNION
  SELECT DISTINCT vet_id FROM vet_loans WHERE user_id = check_user_id
$$;

-- Create a security definer function to check if user owns vet
CREATE OR REPLACE FUNCTION public.user_owns_vet(check_user_id uuid, vet_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_user_id = vet_user_id
$$;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view vets they have relationships with"
ON public.partner_vets
FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_user_vet_ids(auth.uid())));

CREATE POLICY "Vets can view their own record"
ON public.partner_vets
FOR SELECT
TO authenticated
USING (public.user_owns_vet(auth.uid(), user_id));

CREATE POLICY "Admins can view all partner vets"
ON public.partner_vets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage partner vets"
ON public.partner_vets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also fix the pet_profiles vet policy to use a security definer function
DROP POLICY IF EXISTS "Vets can view their patients pet profiles" ON public.pet_profiles;

-- Create security definer function for vet patient access
CREATE OR REPLACE FUNCTION public.vet_can_view_pet(vet_user_id uuid, pet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vet_messages vm
    JOIN partner_vets pv ON pv.id = vm.vet_id
    WHERE pv.user_id = vet_user_id AND vm.pet_id = pet_id
  )
$$;

CREATE POLICY "Vets can view their patients pet profiles"
ON public.pet_profiles
FOR SELECT
TO authenticated
USING (public.vet_can_view_pet(auth.uid(), id));