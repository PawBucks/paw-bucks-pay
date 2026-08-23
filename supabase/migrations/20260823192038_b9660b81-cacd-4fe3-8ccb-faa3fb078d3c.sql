GRANT SELECT ON public.petfest_rsvps TO authenticated;
GRANT ALL ON public.petfest_rsvps TO service_role;

DROP POLICY IF EXISTS "Superadmins can view all RSVPs" ON public.petfest_rsvps;
CREATE POLICY "Superadmins can view all RSVPs"
ON public.petfest_rsvps
FOR SELECT
TO authenticated
USING (public.is_superadmin(auth.uid()));

ALTER TABLE public.petfest_rsvps REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.petfest_rsvps;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;