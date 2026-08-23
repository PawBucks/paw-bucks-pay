-- SETTINGS ------------------------------------------------------------------
CREATE TABLE public.petfest_passport_settings (
  id boolean PRIMARY KEY DEFAULT true,
  event_label text NOT NULL DEFAULT 'PetFest 2027',
  required_stamps integer NOT NULL DEFAULT 6,
  completion_bonus_pawbucks integer NOT NULL DEFAULT 5000,
  is_live boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT petfest_passport_settings_singleton CHECK (id)
);

GRANT SELECT ON public.petfest_passport_settings TO anon, authenticated;
GRANT ALL ON public.petfest_passport_settings TO service_role;
ALTER TABLE public.petfest_passport_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passport settings are public"
  ON public.petfest_passport_settings FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "Admins manage passport settings"
  ON public.petfest_passport_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

INSERT INTO public.petfest_passport_settings (id) VALUES (true);

-- BOOTHS --------------------------------------------------------------------
CREATE TABLE public.petfest_passport_booths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  booth_number text NOT NULL DEFAULT '',
  sponsor_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  pawbucks_reward integer NOT NULL DEFAULT 1000,
  is_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  qr_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT petfest_passport_booths_qr_token_key UNIQUE (qr_token),
  CONSTRAINT petfest_passport_booths_reward_nonneg CHECK (pawbucks_reward >= 0)
);

-- qr_token is deliberately excluded from client grants: scanning it is the game.
GRANT SELECT (id, name, booth_number, sponsor_name, description, pawbucks_reward,
              is_required, is_active, sort_order, created_at, updated_at)
  ON public.petfest_passport_booths TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.petfest_passport_booths TO authenticated;
GRANT ALL ON public.petfest_passport_booths TO service_role;
ALTER TABLE public.petfest_passport_booths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active booths are public"
  ON public.petfest_passport_booths FOR SELECT
  TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins read all booths"
  ON public.petfest_passport_booths FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Admins insert booths"
  ON public.petfest_passport_booths FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Admins update booths"
  ON public.petfest_passport_booths FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Admins delete booths"
  ON public.petfest_passport_booths FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- STAMPS --------------------------------------------------------------------
CREATE TABLE public.petfest_passport_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  booth_id uuid NOT NULL REFERENCES public.petfest_passport_booths(id) ON DELETE CASCADE,
  pawbucks_awarded integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'qr_scan',
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT petfest_passport_stamps_unique UNIQUE (user_id, booth_id)
);

GRANT SELECT ON public.petfest_passport_stamps TO authenticated;
GRANT ALL ON public.petfest_passport_stamps TO service_role;
ALTER TABLE public.petfest_passport_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own stamps"
  ON public.petfest_passport_stamps FOR SELECT
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all stamps"
  ON public.petfest_passport_stamps FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- COMPLETIONS ---------------------------------------------------------------
CREATE TABLE public.petfest_passport_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stamps_count integer NOT NULL DEFAULT 0,
  bonus_pawbucks integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT petfest_passport_completions_user_key UNIQUE (user_id)
);

GRANT SELECT ON public.petfest_passport_completions TO authenticated;
GRANT ALL ON public.petfest_passport_completions TO service_role;
ALTER TABLE public.petfest_passport_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own completion"
  ON public.petfest_passport_completions FOR SELECT
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all completions"
  ON public.petfest_passport_completions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- updated_at triggers -------------------------------------------------------
CREATE TRIGGER trg_petfest_passport_settings_updated_at
  BEFORE UPDATE ON public.petfest_passport_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_petfest_passport_booths_updated_at
  BEFORE UPDATE ON public.petfest_passport_booths
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin-only view of booths including their scan codes (for QR printing).
CREATE OR REPLACE FUNCTION public.get_petfest_passport_booths_admin()
RETURNS TABLE (
  id uuid, name text, booth_number text, sponsor_name text, description text,
  pawbucks_reward integer, is_required boolean, is_active boolean,
  sort_order integer, qr_token uuid, stamp_count bigint, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.booth_number, b.sponsor_name, b.description,
         b.pawbucks_reward, b.is_required, b.is_active, b.sort_order, b.qr_token,
         (SELECT count(*) FROM public.petfest_passport_stamps s WHERE s.booth_id = b.id),
         b.created_at
  FROM public.petfest_passport_booths b
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')
  ORDER BY b.sort_order, b.name
$$;

REVOKE ALL ON FUNCTION public.get_petfest_passport_booths_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.get_petfest_passport_booths_admin() TO authenticated, service_role;