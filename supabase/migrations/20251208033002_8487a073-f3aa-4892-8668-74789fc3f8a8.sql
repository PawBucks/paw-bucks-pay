-- Ensure merchants_public view is accessible to all authenticated users
-- This is intentional: merchant business info (name, address, phone, etc.) should be publicly discoverable

GRANT SELECT ON public.merchants_public TO authenticated;
GRANT SELECT ON public.merchants_public TO anon;