-- Ensure SELECT grants on merchants_public view for public access
-- This is required because views inherit RLS from base tables but still need explicit grants

-- Grant SELECT to anon role (unauthenticated users)
GRANT SELECT ON public.merchants_public TO anon;

-- Grant SELECT to authenticated role (logged in users)
GRANT SELECT ON public.merchants_public TO authenticated;

-- Also ensure the authenticator role can access it (used by PostgREST)
GRANT SELECT ON public.merchants_public TO authenticator;