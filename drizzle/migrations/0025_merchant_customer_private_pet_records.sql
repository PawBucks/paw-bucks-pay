CREATE TABLE public.merchant_client_pets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
 client_id uuid REFERENCES public.invoice_clients(id) ON DELETE CASCADE, user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100), species text NOT NULL DEFAULT 'dog' CHECK (species IN ('dog','cat','other')),
 breed text, birthdate date, age_estimate text, sex text CHECK (sex IN ('male','female','unknown')), spayed_neutered boolean,
 color_markings text, weight_lbs numeric CHECK (weight_lbs > 0), size text CHECK (size IN ('small','medium','large','giant')), microchip_number text, photo_url text,
 vet_clinic_name text, vet_doctor_name text, vet_phone text, medical_conditions text, allergies text, medications text,
 vaccinations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(vaccinations) = 'array'),
 grooming_coat_type text, grooming_preferences text, temperament_notes text, handling_cautions text, special_instructions text,
 emergency_contact_name text, emergency_contact_phone text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT merchant_pet_customer_required CHECK (client_id IS NOT NULL OR user_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_client_pets TO authenticated;
GRANT ALL ON public.merchant_client_pets TO service_role;
ALTER TABLE public.merchant_client_pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY merchant_private_pets_select ON public.merchant_client_pets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id=merchant_id AND m.user_id=auth.uid()));
CREATE POLICY merchant_private_pets_insert ON public.merchant_client_pets FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id=merchant_id AND m.user_id=auth.uid()));
CREATE POLICY merchant_private_pets_update ON public.merchant_client_pets FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id=merchant_id AND m.user_id=auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id=merchant_id AND m.user_id=auth.uid()));
CREATE POLICY merchant_private_pets_delete ON public.merchant_client_pets FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id=merchant_id AND m.user_id=auth.uid()));
CREATE INDEX merchant_client_pets_merchant_idx ON public.merchant_client_pets(merchant_id);
CREATE FUNCTION public.validate_merchant_client_pet() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.merchant_id IS DISTINCT FROM OLD.merchant_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.client_id IS DISTINCT FROM OLD.client_id) THEN RAISE EXCEPTION 'Pet customer links cannot be changed'; END IF;
 IF NEW.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.invoice_clients c WHERE c.id=NEW.client_id AND c.merchant_id=NEW.merchant_id) THEN RAISE EXCEPTION 'Customer does not belong to this business'; END IF;
 IF NEW.user_id IS NOT NULL AND NOT (EXISTS (SELECT 1 FROM public.service_bookings b WHERE b.merchant_id=NEW.merchant_id AND b.user_id=NEW.user_id) OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.merchant_id=NEW.merchant_id AND t.user_id=NEW.user_id) OR EXISTS (SELECT 1 FROM public.merchant_subscriptions s WHERE s.merchant_id=NEW.merchant_id AND s.user_id=NEW.user_id)) THEN RAISE EXCEPTION 'Customer has no relationship with this business'; END IF;
 IF NEW.birthdate > CURRENT_DATE THEN RAISE EXCEPTION 'Birthdate cannot be in the future'; END IF;
 IF jsonb_array_length(NEW.vaccinations)>50 THEN RAISE EXCEPTION 'Too many vaccination entries'; END IF;
 NEW.updated_at=now(); RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_merchant_client_pet() FROM PUBLIC;
CREATE TRIGGER validate_merchant_client_pet BEFORE INSERT OR UPDATE ON public.merchant_client_pets FOR EACH ROW EXECUTE FUNCTION public.validate_merchant_client_pet();
COMMENT ON TABLE public.merchant_client_pets IS 'Business-maintained customer pet notes only; independent of owner and veterinarian clinical records. No administrative access.';