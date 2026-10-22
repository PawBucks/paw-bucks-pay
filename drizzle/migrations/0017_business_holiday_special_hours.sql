CREATE TABLE public.business_special_hours (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
 vet_id uuid REFERENCES public.partner_vets(id) ON DELETE CASCADE,
 special_date date NOT NULL,
 label text NOT NULL DEFAULT '',
 is_closed boolean NOT NULL DEFAULT true,
 repeat_annually boolean NOT NULL DEFAULT false,
 windows jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT special_hours_one_business CHECK ((merchant_id IS NOT NULL)::integer + (vet_id IS NOT NULL)::integer = 1),
 CONSTRAINT special_hours_label_length CHECK (length(label) <= 100)
);
GRANT SELECT ON public.business_special_hours TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_special_hours TO authenticated;
GRANT ALL ON public.business_special_hours TO service_role;
ALTER TABLE public.business_special_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public special operating hours" ON public.business_special_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners manage special operating hours" ON public.business_special_hours FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.partner_vets v WHERE v.id = vet_id AND v.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.partner_vets v WHERE v.id = vet_id AND v.user_id = auth.uid()));
CREATE UNIQUE INDEX special_hours_merchant_date ON public.business_special_hours (merchant_id, special_date) WHERE merchant_id IS NOT NULL;
CREATE UNIQUE INDEX special_hours_vet_date ON public.business_special_hours (vet_id, special_date) WHERE vet_id IS NOT NULL;
CREATE FUNCTION public.validate_business_special_hours() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE w jsonb; previous_end time; start_at time; end_at time;
BEGIN
 IF jsonb_typeof(NEW.windows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Special hours must be a list of open windows'; END IF;
 IF NEW.is_closed THEN NEW.windows := '[]'::jsonb; RETURN NEW; END IF;
 IF jsonb_array_length(NEW.windows) < 1 THEN RAISE EXCEPTION 'Add at least one open window'; END IF;
 FOR w IN SELECT value FROM jsonb_array_elements(NEW.windows) ORDER BY value->>'start_time' LOOP
  IF coalesce(w->>'start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(w->>'end_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Enter valid start and end times'; END IF;
  start_at := (w->>'start_time')::time; end_at := (w->>'end_time')::time;
  IF start_at >= end_at THEN RAISE EXCEPTION 'Each open window must end after it starts'; END IF;
  IF previous_end IS NOT NULL AND start_at < previous_end THEN RAISE EXCEPTION 'Open windows cannot overlap'; END IF;
  previous_end := end_at;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_special_hours BEFORE INSERT OR UPDATE ON public.business_special_hours FOR EACH ROW EXECUTE FUNCTION public.validate_business_special_hours();
CREATE FUNCTION public.business_special_hours_allows(_merchant_id uuid, _vet_id uuid, _date date, _start time, _end time) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE matches jsonb;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('is_closed', s.is_closed, 'windows', s.windows)) INTO matches
 FROM public.business_special_hours s
 WHERE ((_merchant_id IS NOT NULL AND s.merchant_id = _merchant_id) OR (_vet_id IS NOT NULL AND s.vet_id = _vet_id))
 AND (s.special_date = _date OR (s.repeat_annually AND to_char(s.special_date,'MM-DD') = to_char(_date,'MM-DD')));
 IF matches IS NULL THEN RETURN true; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(matches) x WHERE (x->>'is_closed')::boolean) THEN RETURN false; END IF;
 RETURN _end > _start AND EXISTS (SELECT 1 FROM jsonb_array_elements(matches) x CROSS JOIN LATERAL jsonb_array_elements(x->'windows') w WHERE _start >= (w->>'start_time')::time AND _end <= (w->>'end_time')::time);
END $$;
REVOKE ALL ON FUNCTION public.business_special_hours_allows(uuid, uuid, date, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_special_hours_allows(uuid, uuid, date, time, time) TO anon, authenticated, service_role;
CREATE FUNCTION public.enforce_booking_special_hours() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.status IN ('pending', 'confirmed') AND NOT public.business_special_hours_allows(NEW.merchant_id, NULL, NEW.booking_date, NEW.start_time, NEW.end_time) THEN
  RAISE EXCEPTION 'This business is closed or the appointment falls outside its special hours. Please choose another time.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enforce_booking_special_hours BEFORE INSERT OR UPDATE OF booking_date, start_time, end_time, merchant_id, status ON public.service_bookings FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_special_hours();