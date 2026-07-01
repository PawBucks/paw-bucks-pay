GRANT SELECT ON public.partner_offers TO anon, authenticated;
GRANT ALL ON public.partner_offers TO service_role;

GRANT SELECT ON public.merchants_public TO anon, authenticated;
GRANT ALL ON public.merchants_public TO service_role;