ALTER TABLE public.merchant_client_pets ADD COLUMN pet_profile_id uuid;
CREATE UNIQUE INDEX merchant_client_pets_profile_unique ON public.merchant_client_pets(merchant_id, pet_profile_id) WHERE pet_profile_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.validate_merchant_client_pet()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.merchant_id IS DISTINCT FROM OLD.merchant_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.pet_profile_id IS DISTINCT FROM OLD.pet_profile_id) THEN RAISE EXCEPTION 'Pet customer links cannot be changed'; END IF;
 IF NEW.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.invoice_clients c WHERE c.id=NEW.client_id AND c.merchant_id=NEW.merchant_id) THEN RAISE EXCEPTION 'Customer does not belong to this business'; END IF;
 IF NEW.user_id IS NOT NULL AND NOT (EXISTS (SELECT 1 FROM public.service_bookings b WHERE b.merchant_id=NEW.merchant_id AND b.user_id=NEW.user_id) OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.merchant_id=NEW.merchant_id AND t.user_id=NEW.user_id) OR EXISTS (SELECT 1 FROM public.merchant_subscriptions s WHERE s.merchant_id=NEW.merchant_id AND s.user_id=NEW.user_id)) THEN RAISE EXCEPTION 'Customer has no relationship with this business'; END IF;
 IF NEW.pet_profile_id IS NOT NULL AND (NEW.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.service_bookings b WHERE b.merchant_id=NEW.merchant_id AND b.pet_id=NEW.pet_profile_id AND b.user_id=NEW.user_id)) THEN RAISE EXCEPTION 'Pet was not booked by this customer at this business'; END IF;
 IF NEW.birthdate > CURRENT_DATE THEN RAISE EXCEPTION 'Birthdate cannot be in the future'; END IF;
 IF jsonb_array_length(NEW.vaccinations)>50 THEN RAISE EXCEPTION 'Too many vaccination entries'; END IF;
 NEW.updated_at=now(); RETURN NEW;
END; $function$;