-- Grant SELECT access on merchants_public view to anon and authenticated roles
GRANT SELECT ON public.merchants_public TO anon;
GRANT SELECT ON public.merchants_public TO authenticated;