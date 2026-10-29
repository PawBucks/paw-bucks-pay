CREATE TABLE public.care_action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('view','save','directions','contact','call','website','inquire','rsvp','book','share')),
  target_type text NOT NULL CHECK (target_type IN ('merchant','guide_place','event','community_post','vet')),
  target_id text NOT NULL CHECK (char_length(target_id) <= 120),
  merchant_id uuid,
  source text CHECK (source IS NULL OR char_length(source) <= 60),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_action_events_user_idx ON public.care_action_events(user_id, created_at DESC);
CREATE INDEX care_action_events_merchant_idx ON public.care_action_events(merchant_id, created_at DESC) WHERE merchant_id IS NOT NULL;
GRANT SELECT, INSERT ON public.care_action_events TO authenticated;
GRANT ALL ON public.care_action_events TO service_role;
ALTER TABLE public.care_action_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users log own care actions" ON public.care_action_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own care actions" ON public.care_action_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read care actions" ON public.care_action_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Merchants read actions on their business" ON public.care_action_events FOR SELECT TO authenticated USING (merchant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = care_action_events.merchant_id AND m.user_id = auth.uid()));