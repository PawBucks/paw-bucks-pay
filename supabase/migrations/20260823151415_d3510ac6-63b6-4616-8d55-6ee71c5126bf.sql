CREATE TABLE public.petfest_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  pet_count INTEGER NOT NULL DEFAULT 1 CHECK (pet_count >= 1 AND pet_count <= 20),
  pet_name TEXT NOT NULL,
  pet_breed TEXT,
  pet_birthday DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.petfest_rsvps TO anon;
GRANT INSERT, SELECT ON public.petfest_rsvps TO authenticated;
GRANT ALL ON public.petfest_rsvps TO service_role;

ALTER TABLE public.petfest_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a PetFest RSVP"
ON public.petfest_rsvps FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(full_name) BETWEEN 1 AND 100
  AND char_length(email) BETWEEN 3 AND 255
  AND char_length(phone) BETWEEN 7 AND 20
  AND char_length(pet_name) BETWEEN 1 AND 50
  AND (user_id IS NULL OR user_id = auth.uid())
);

CREATE POLICY "Users can view their own RSVP"
ON public.petfest_rsvps FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all RSVPs"
ON public.petfest_rsvps FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_petfest_rsvps_email ON public.petfest_rsvps (email);