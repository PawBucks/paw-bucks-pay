-- Remove the overly permissive RLS policy that exposes sensitive merchant data
-- The merchants_public VIEW should be the only public access point
DROP POLICY IF EXISTS "Public can view merchants via public view" ON public.merchants;

-- Verify that merchants_public view only exposes non-sensitive fields
-- (The view already correctly excludes phone, email, contact_person, owner_name, stripe_account_id)
-- Just ensure grants are in place for the view
GRANT SELECT ON public.merchants_public TO anon, authenticated;