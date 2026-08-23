CREATE OR REPLACE FUNCTION public.create_petfest_bonus_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.petfest_bonus_reservations (rsvp_id, email, token, pawbucks_amount, expires_at)
  VALUES (NEW.id, lower(NEW.email), gen_random_uuid()::text, 5000, now() + interval '5 minutes')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_petfest_rsvp_bonus ON public.petfest_rsvps;
CREATE TRIGGER trg_petfest_rsvp_bonus
AFTER INSERT ON public.petfest_rsvps
FOR EACH ROW EXECUTE FUNCTION public.create_petfest_bonus_reservation();

-- Backfill RSVPs that never got a reservation row (window already elapsed -> expired)
INSERT INTO public.petfest_bonus_reservations (rsvp_id, email, token, pawbucks_amount, expires_at, status, reserved_at)
SELECT r.id, lower(r.email), gen_random_uuid()::text, 5000, r.created_at + interval '5 minutes',
       CASE WHEN r.created_at + interval '5 minutes' < now() THEN 'expired' ELSE 'reserved' END,
       r.created_at
FROM public.petfest_rsvps r
LEFT JOIN public.petfest_bonus_reservations b ON b.rsvp_id = r.id
WHERE b.id IS NULL;