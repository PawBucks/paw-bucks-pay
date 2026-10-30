CREATE TABLE public.merchant_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 80),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 600),
  link_url text CHECK (link_url IS NULL OR link_url ~ '^https://'),
  expires_at timestamptz,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX merchant_updates_merchant_idx ON public.merchant_updates(merchant_id, created_at DESC);
GRANT SELECT ON public.merchant_updates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_updates TO authenticated;
GRANT ALL ON public.merchant_updates TO service_role;
ALTER TABLE public.merchant_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active updates of approved businesses" ON public.merchant_updates
FOR SELECT TO anon, authenticated
USING (
  is_hidden = false AND (expires_at IS NULL OR expires_at > now())
  AND EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.approval_status = 'approved' AND m.is_paused = false)
);
CREATE POLICY "Owners read own updates" ON public.merchant_updates
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));
CREATE POLICY "Owners create own updates" ON public.merchant_updates
FOR INSERT TO authenticated
WITH CHECK (is_hidden = false AND EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));
CREATE POLICY "Owners edit own updates" ON public.merchant_updates
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));
CREATE POLICY "Owners delete own updates" ON public.merchant_updates
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));
CREATE POLICY "Admins manage updates" ON public.merchant_updates
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- Owners cannot unhide moderator-hidden updates
CREATE OR REPLACE FUNCTION public.merchant_updates_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
     AND auth.role() <> 'service_role' THEN
    NEW.is_hidden := OLD.is_hidden;
  END IF;
  NEW.merchant_id := OLD.merchant_id;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER merchant_updates_guard BEFORE UPDATE ON public.merchant_updates
FOR EACH ROW EXECUTE FUNCTION public.merchant_updates_guard();