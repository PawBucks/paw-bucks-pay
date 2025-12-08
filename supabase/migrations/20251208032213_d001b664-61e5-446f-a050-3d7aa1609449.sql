-- Fix partner_vets security: Remove policy that exposes sensitive data to relationship users
-- Instead, relationship users should use partner_vets_public view for non-sensitive data

-- Drop the problematic policy that exposes all columns to relationship users
DROP POLICY IF EXISTS "Users can view vets they have relationships with" ON public.partner_vets;

-- Create a new restrictive policy - users with relationships can only see basic info
-- They should use the partner_vets_public view instead for non-sensitive data
-- The base table should only be fully accessible to admins and vet owners

-- Force RLS on partner_vets to prevent bypasses
ALTER TABLE public.partner_vets FORCE ROW LEVEL SECURITY;

-- Ensure partner_vets_public view grants are in place for authenticated users
GRANT SELECT ON public.partner_vets_public TO authenticated;

-- Create a function to check if a user has a relationship with a vet (for use in application code)
CREATE OR REPLACE FUNCTION public.user_has_vet_relationship(check_user_id uuid, check_vet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vet_messages 
    WHERE user_id = check_user_id AND vet_id = check_vet_id
  ) OR EXISTS (
    SELECT 1 FROM vet_loans 
    WHERE user_id = check_user_id AND vet_id = check_vet_id
  )
$$;