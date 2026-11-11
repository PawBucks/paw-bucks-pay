CREATE TABLE public.public_pet_pros (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_name text NOT NULL CHECK(length(business_name) BETWEEN 2 AND 200), category text NOT NULL DEFAULT 'other', address text, phone text, email text, website_url text, latitude numeric CHECK(latitude BETWEEN -90 AND 90), longitude numeric CHECK(longitude BETWEEN -180 AND 180), source_url text NOT NULL, source_key text NOT NULL UNIQUE, is_hidden boolean NOT NULL DEFAULT false, reuse_confirmed boolean NOT NULL DEFAULT false, linked_merchant_id uuid REFERENCES public.merchants(id), linked_vet_id uuid REFERENCES public.partner_vets(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_pet_pros TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_pet_pros TO authenticated;
GRANT ALL ON public.public_pet_pros TO service_role;
ALTER TABLE public.public_pet_pros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible reusable public listings" ON public.public_pet_pros FOR SELECT TO anon,authenticated USING (NOT is_hidden AND reuse_confirmed AND linked_merchant_id IS NULL AND linked_vet_id IS NULL);
CREATE POLICY "Admins manage directory" ON public.public_pet_pros FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));
CREATE TABLE public.pet_pro_claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid NOT NULL REFERENCES public.public_pet_pros(id), user_id uuid NOT NULL, contact_name text NOT NULL CHECK(length(contact_name) BETWEEN 2 AND 200), contact_email text NOT NULL, evidence text NOT NULL CHECK(length(evidence) BETWEEN 10 AND 2000), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), reviewer_id uuid, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(listing_id,user_id));
GRANT SELECT,INSERT ON public.pet_pro_claims TO authenticated;
GRANT ALL ON public.pet_pro_claims TO service_role;
ALTER TABLE public.pet_pro_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Claimants read own requests" ON public.pet_pro_claims FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "Claimants submit pending request" ON public.pet_pro_claims FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND status='pending' AND reviewer_id IS NULL AND reviewed_at IS NULL AND EXISTS(SELECT 1 FROM public.public_pet_pros p WHERE p.id=listing_id AND NOT p.is_hidden AND p.reuse_confirmed));
CREATE POLICY "Admins read claims" ON public.pet_pro_claims FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));
CREATE TABLE public.pet_pro_search_cache (search_key text PRIMARY KEY, results jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.pet_pro_search_cache TO service_role;
ALTER TABLE public.pet_pro_search_cache ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.review_pet_pro_claim(_claim_id uuid,_approve boolean,_merchant_id uuid DEFAULT NULL,_vet_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.pet_pro_claims;
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO c FROM public.pet_pro_claims WHERE id=_claim_id FOR UPDATE;
 IF NOT FOUND OR c.status<>'pending' THEN RAISE EXCEPTION 'Pending claim not found'; END IF;
 IF _approve THEN
 IF (_merchant_id IS NULL)=(_vet_id IS NULL) THEN RAISE EXCEPTION 'Choose exactly one verified business account'; END IF;
 IF _merchant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.merchants WHERE id=_merchant_id AND user_id=c.user_id) THEN RAISE EXCEPTION 'Business does not belong to claimant'; END IF;
 IF _vet_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.partner_vets WHERE id=_vet_id AND user_id=c.user_id) THEN RAISE EXCEPTION 'Business does not belong to claimant'; END IF;
 UPDATE public.public_pet_pros SET linked_merchant_id=_merchant_id,linked_vet_id=_vet_id,updated_at=now() WHERE id=c.listing_id;
 END IF;
 UPDATE public.pet_pro_claims SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,reviewer_id=auth.uid(),reviewed_at=now() WHERE id=_claim_id;
END; $$;
REVOKE ALL ON FUNCTION public.review_pet_pro_claim(uuid,boolean,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_pet_pro_claim(uuid,boolean,uuid,uuid) TO authenticated,service_role;