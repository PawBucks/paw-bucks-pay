ALTER TABLE public.partner_vets ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paused_at timestamptz, ADD COLUMN IF NOT EXISTS paused_by uuid, ADD COLUMN IF NOT EXISTS pause_reason text;
DO $$
DECLARE view_name text; definition text;
BEGIN
 FOREACH view_name IN ARRAY ARRAY['merchants_public','partner_vets_public'] LOOP
  definition := rtrim(pg_get_viewdef(('public.' || view_name)::regclass, true), E';\n ');
  EXECUTE format('CREATE OR REPLACE VIEW public.%I AS %s AND COALESCE(is_paused, false) = false', view_name, definition);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_merchant_pause(_merchant_id uuid, _paused boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF _paused IS NULL THEN RAISE EXCEPTION 'Disabled status is required'; END IF;
 UPDATE public.merchants SET is_paused=_paused, paused_at=CASE WHEN _paused THEN now() ELSE NULL END, paused_by=CASE WHEN _paused THEN auth.uid() ELSE NULL END, pause_reason=CASE WHEN _paused THEN NULLIF(left(trim(_reason),500),'') ELSE NULL END WHERE id=_merchant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Merchant not found'; END IF;
 PERFORM public.log_admin_action(CASE WHEN _paused THEN 'DISABLE_MERCHANT' ELSE 'RESTORE_MERCHANT' END, 'merchant', _merchant_id, jsonb_build_object('is_paused',_paused,'pause_reason',_reason));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_merchant_pause(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_merchant_pause(uuid,boolean,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.admin_set_vet_pause(_vet_id uuid, _paused boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF _paused IS NULL THEN RAISE EXCEPTION 'Disabled status is required'; END IF;
 UPDATE public.partner_vets SET is_paused=_paused, paused_at=CASE WHEN _paused THEN now() ELSE NULL END, paused_by=CASE WHEN _paused THEN auth.uid() ELSE NULL END, pause_reason=CASE WHEN _paused THEN NULLIF(left(trim(_reason),500),'') ELSE NULL END WHERE id=_vet_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vet not found'; END IF;
 PERFORM public.log_admin_action(CASE WHEN _paused THEN 'DISABLE_VET' ELSE 'RESTORE_VET' END, 'vet', _vet_id, jsonb_build_object('is_paused',_paused,'pause_reason',_reason));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_vet_pause(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_vet_pause(uuid,boolean,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_vet_pause_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('anon','authenticated') AND (TG_OP='INSERT' AND (NEW.is_paused OR NEW.paused_at IS NOT NULL OR NEW.paused_by IS NOT NULL OR NEW.pause_reason IS NOT NULL) OR TG_OP='UPDATE' AND (NEW.is_paused,NEW.paused_at,NEW.paused_by,NEW.pause_reason) IS DISTINCT FROM (OLD.is_paused,OLD.paused_at,OLD.paused_by,OLD.pause_reason)) THEN
  RAISE EXCEPTION 'Use the administrator account controls' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_vet_pause_fields BEFORE INSERT OR UPDATE ON public.partner_vets FOR EACH ROW EXECUTE FUNCTION public.guard_vet_pause_fields();
CREATE OR REPLACE FUNCTION public.get_marketplace_merchants(p_search text DEFAULT NULL, p_category text DEFAULT NULL, p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid,business_name text,business_type text,business_categories text[],logo_url text,address text,description text,cashback_rate numeric,accepts_pawbucks boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT m.id,m.business_name,m.business_type,m.business_categories,m.logo_url,m.address,m.description,m.cashback_rate,m.accepts_pawbucks FROM public.merchants m
 WHERE m.approval_status='approved' AND COALESCE(m.is_paused,false)=false AND COALESCE(m.onboarding_complete,false)=true AND COALESCE(m.accepts_pawbucks,false)=true AND (p_search IS NULL OR m.business_name ILIKE '%'||p_search||'%') AND (p_category IS NULL OR m.business_type=p_category OR p_category=ANY(COALESCE(m.business_categories,ARRAY[]::text[]))) ORDER BY m.business_name LIMIT p_limit;
$$;