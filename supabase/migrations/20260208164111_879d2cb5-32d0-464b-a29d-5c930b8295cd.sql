-- Fix RLS policy for pet_health_access_codes to support shared accounts
-- Drop existing owner SELECT policy
DROP POLICY IF EXISTS "Owners can view their access codes" ON public.pet_health_access_codes;

-- Create updated policy that allows both owners AND shared account members
CREATE POLICY "Owners and shared members can view access codes"
ON public.pet_health_access_codes
FOR SELECT
USING (
  auth.uid() = owner_id 
  OR public.is_shared_member_of(owner_id)
);

-- Also update INSERT policy to support shared accounts
DROP POLICY IF EXISTS "Owners can create access codes" ON public.pet_health_access_codes;

CREATE POLICY "Owners and shared members can create access codes"
ON public.pet_health_access_codes
FOR INSERT
WITH CHECK (
  auth.uid() = owner_id 
  OR public.is_shared_member_of(owner_id)
);

-- Update UPDATE policy
DROP POLICY IF EXISTS "Owners can update their access codes" ON public.pet_health_access_codes;

CREATE POLICY "Owners and shared members can update access codes"
ON public.pet_health_access_codes
FOR UPDATE
USING (
  auth.uid() = owner_id 
  OR public.is_shared_member_of(owner_id)
);

-- Update DELETE policy
DROP POLICY IF EXISTS "Owners can delete their access codes" ON public.pet_health_access_codes;

CREATE POLICY "Owners and shared members can delete access codes"
ON public.pet_health_access_codes
FOR DELETE
USING (
  auth.uid() = owner_id 
  OR public.is_shared_member_of(owner_id)
);