ALTER TABLE public.petfest_rsvps
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS petfest_rsvps_ip_created_idx ON public.petfest_rsvps (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS petfest_rsvps_email_created_idx ON public.petfest_rsvps (lower(email), created_at DESC);

-- Submissions now go through a server-side function that does bot + rate-limit checks.
DROP POLICY IF EXISTS "Anyone can submit a PetFest RSVP" ON public.petfest_rsvps;
REVOKE INSERT ON public.petfest_rsvps FROM anon, authenticated;
GRANT ALL ON public.petfest_rsvps TO service_role;