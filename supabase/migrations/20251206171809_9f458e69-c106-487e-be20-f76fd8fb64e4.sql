-- Create a public view for partner_vets that excludes sensitive fields
-- This follows the same pattern as merchants_public

CREATE OR REPLACE VIEW public.partner_vets_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  location,
  created_at
FROM public.partner_vets;

-- Grant access to the view
GRANT SELECT ON public.partner_vets_public TO anon, authenticated;

-- Update the RLS policy on partner_vets to restrict public access
-- First, drop the overly permissive policy
DROP POLICY IF EXISTS "Everyone can view partner vets" ON public.partner_vets;

-- Create more restrictive policies:
-- 1. Admins can view all partner vets (full records)
CREATE POLICY "Admins can view all partner vets" 
ON public.partner_vets 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Vets can view their own record
CREATE POLICY "Vets can view their own record" 
ON public.partner_vets 
FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Users with vet relationships can view their vet's record
CREATE POLICY "Users can view vets they have relationships with" 
ON public.partner_vets 
FOR SELECT 
USING (
  id IN (
    SELECT DISTINCT vet_id FROM public.vet_messages WHERE user_id = auth.uid()
    UNION
    SELECT DISTINCT vet_id FROM public.vet_loans WHERE user_id = auth.uid()
  )
);