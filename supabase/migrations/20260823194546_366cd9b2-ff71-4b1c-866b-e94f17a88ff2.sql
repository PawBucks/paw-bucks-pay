GRANT SELECT ON public.petfest_bonus_reservations TO authenticated;
GRANT ALL ON public.petfest_bonus_reservations TO service_role;
GRANT SELECT ON public.petfest_bonus_events TO authenticated;
GRANT ALL ON public.petfest_bonus_events TO service_role;
ALTER TABLE public.petfest_bonus_reservations REPLICA IDENTITY FULL;
ALTER TABLE public.petfest_bonus_events REPLICA IDENTITY FULL;
ALTER TABLE public.petfest_rsvps REPLICA IDENTITY FULL;