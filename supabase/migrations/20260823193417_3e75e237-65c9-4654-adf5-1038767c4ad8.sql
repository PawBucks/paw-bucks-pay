GRANT SELECT ON public.petfest_bonus_reservations TO authenticated;
GRANT SELECT ON public.petfest_bonus_events TO authenticated;
GRANT ALL ON public.petfest_bonus_reservations TO service_role;
GRANT ALL ON public.petfest_bonus_events TO service_role;

ALTER TABLE public.petfest_bonus_reservations REPLICA IDENTITY FULL;
ALTER TABLE public.petfest_bonus_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'petfest_bonus_reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.petfest_bonus_reservations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'petfest_bonus_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.petfest_bonus_events;
  END IF;
END $$;