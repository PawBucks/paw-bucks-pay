CREATE TABLE public.petfest_bonus_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id uuid REFERENCES public.petfest_rsvps(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  pawbucks_amount integer NOT NULL DEFAULT 5000,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','claimed','expired')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  claimed_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_petfest_bonus_res_status ON public.petfest_bonus_reservations(status, expires_at);
CREATE INDEX idx_petfest_bonus_res_email ON public.petfest_bonus_reservations(lower(email));

GRANT SELECT ON public.petfest_bonus_reservations TO authenticated;
GRANT ALL ON public.petfest_bonus_reservations TO service_role;
ALTER TABLE public.petfest_bonus_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view petfest bonus reservations"
ON public.petfest_bonus_reservations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.petfest_bonus_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.petfest_bonus_reservations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('cta_click','signup_started','claim_granted','claim_rejected','claim_expired')),
  email text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_petfest_bonus_events_type ON public.petfest_bonus_events(event_type, created_at DESC);
CREATE INDEX idx_petfest_bonus_events_res ON public.petfest_bonus_events(reservation_id);

GRANT SELECT ON public.petfest_bonus_events TO authenticated;
GRANT ALL ON public.petfest_bonus_events TO service_role;
ALTER TABLE public.petfest_bonus_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view petfest bonus events"
ON public.petfest_bonus_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_petfest_bonus_res_updated_at
BEFORE UPDATE ON public.petfest_bonus_reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.expire_petfest_bonus_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.petfest_bonus_reservations
    SET status = 'expired', updated_at = now()
    WHERE status = 'reserved' AND expires_at <= now()
    RETURNING id, email
  ), logged AS (
    INSERT INTO public.petfest_bonus_events (reservation_id, event_type, email, metadata)
    SELECT id, 'claim_expired', email, jsonb_build_object('reason', 'window_elapsed')
    FROM expired
    RETURNING 1
  )
  SELECT count(*) INTO expired_count FROM logged;

  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_petfest_bonus_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_petfest_bonus_reservations() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('expire-petfest-bonus-reservations');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'expire-petfest-bonus-reservations',
    '* * * * *',
    $cron$SELECT public.expire_petfest_bonus_reservations();$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron scheduling unavailable: %', SQLERRM;
END $$;