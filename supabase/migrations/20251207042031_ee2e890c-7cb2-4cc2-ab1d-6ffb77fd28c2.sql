-- Grant SELECT access to merchants_public view for anon and authenticated users
GRANT SELECT ON public.merchants_public TO anon;
GRANT SELECT ON public.merchants_public TO authenticated;