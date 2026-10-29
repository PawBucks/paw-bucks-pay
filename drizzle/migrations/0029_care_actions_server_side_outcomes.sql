ALTER TABLE public.care_action_events DROP CONSTRAINT IF EXISTS care_action_events_action_check;
ALTER TABLE public.care_action_events ADD CONSTRAINT care_action_events_action_check
  CHECK (action IN ('view','save','directions','contact','call','website','inquire','rsvp','book','attend','share'));

CREATE OR REPLACE FUNCTION public.care_log_booking_outcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.recurring_parent_id IS NULL AND NEW.rescheduled_from_id IS NULL THEN
    INSERT INTO public.care_action_events(user_id, action, target_type, target_id, merchant_id, source)
    VALUES (NEW.user_id, 'book', 'merchant', NEW.merchant_id::text, NEW.merchant_id, 'booking');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.care_action_events(user_id, action, target_type, target_id, merchant_id, source)
    VALUES (NEW.user_id, 'attend', 'merchant', NEW.merchant_id::text, NEW.merchant_id, 'booking');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS care_log_booking_outcome ON public.service_bookings;
CREATE TRIGGER care_log_booking_outcome AFTER INSERT OR UPDATE OF status ON public.service_bookings
FOR EACH ROW EXECUTE FUNCTION public.care_log_booking_outcome();

CREATE OR REPLACE FUNCTION public.care_log_inquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.sender_type IN ('merchant','business','vet') THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.care_action_events e WHERE e.user_id = NEW.user_id AND e.merchant_id = NEW.merchant_id
             AND e.action = 'inquire' AND e.created_at > now() - interval '24 hours') THEN RETURN NEW; END IF;
  INSERT INTO public.care_action_events(user_id, action, target_type, target_id, merchant_id, source)
  VALUES (NEW.user_id, 'inquire', 'merchant', NEW.merchant_id::text, NEW.merchant_id, 'message');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS care_log_inquiry ON public.merchant_messages;
CREATE TRIGGER care_log_inquiry AFTER INSERT ON public.merchant_messages
FOR EACH ROW EXECUTE FUNCTION public.care_log_inquiry();

CREATE OR REPLACE FUNCTION public.care_log_petfest_rsvp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.care_action_events(user_id, action, target_type, target_id, source)
    VALUES (NEW.user_id, 'rsvp', 'event', 'petfest', 'petfest_rsvp');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS care_log_petfest_rsvp ON public.petfest_rsvps;
CREATE TRIGGER care_log_petfest_rsvp AFTER INSERT ON public.petfest_rsvps
FOR EACH ROW EXECUTE FUNCTION public.care_log_petfest_rsvp();