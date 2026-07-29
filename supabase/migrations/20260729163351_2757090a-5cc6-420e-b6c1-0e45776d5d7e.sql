
CREATE TABLE public.guide_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_slug text NOT NULL,
  section text NOT NULL CHECK (section IN ('parks','beaches','cafes')),
  name text NOT NULL,
  area text NOT NULL,
  description text NOT NULL,
  tag text,
  tag_label text,
  tip text,
  tip_icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guide_places TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.guide_places TO authenticated;
GRANT ALL ON public.guide_places TO service_role;
ALTER TABLE public.guide_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guide_places public read active" ON public.guide_places FOR SELECT USING (is_active = true);
CREATE POLICY "guide_places admin all" ON public.guide_places FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.guide_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_slug text NOT NULL,
  name text NOT NULL,
  area text NOT NULL,
  description text NOT NULL,
  tag text,
  tag_label text,
  tip text,
  tip_icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guide_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.guide_events TO authenticated;
GRANT ALL ON public.guide_events TO service_role;
ALTER TABLE public.guide_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guide_events public read active" ON public.guide_events FOR SELECT USING (is_active = true);
CREATE POLICY "guide_events admin all" ON public.guide_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.guide_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_slug text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guide_faqs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.guide_faqs TO authenticated;
GRANT ALL ON public.guide_faqs TO service_role;
ALTER TABLE public.guide_faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guide_faqs public read active" ON public.guide_faqs FOR SELECT USING (is_active = true);
CREATE POLICY "guide_faqs admin all" ON public.guide_faqs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE INDEX idx_guide_places_slug_section ON public.guide_places(guide_slug, section, sort_order);
CREATE INDEX idx_guide_events_slug ON public.guide_events(guide_slug, sort_order);
CREATE INDEX idx_guide_faqs_slug ON public.guide_faqs(guide_slug, sort_order);

CREATE TRIGGER trg_guide_places_updated BEFORE UPDATE ON public.guide_places
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_guide_events_updated BEFORE UPDATE ON public.guide_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_guide_faqs_updated BEFORE UPDATE ON public.guide_faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
