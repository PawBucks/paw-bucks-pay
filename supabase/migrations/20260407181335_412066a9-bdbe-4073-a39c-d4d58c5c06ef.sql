
-- Table to track check-in follow-up notifications
CREATE TABLE public.checkin_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkin_id UUID NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  vet_id UUID REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'answered')),
  response TEXT CHECK (response IN ('yes', 'still_shopping', 'no')),
  visit_purpose TEXT,
  notify_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for the cron job to find pending follow-ups efficiently
CREATE INDEX idx_checkin_followups_pending ON public.checkin_followups (status, notify_at) WHERE status = 'pending';
CREATE INDEX idx_checkin_followups_user ON public.checkin_followups (user_id, status);

-- Enable RLS
ALTER TABLE public.checkin_followups ENABLE ROW LEVEL SECURITY;

-- Pet owners can view their own follow-ups
CREATE POLICY "Users can view own followups"
  ON public.checkin_followups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Pet owners can update their own follow-ups (to submit responses)
CREATE POLICY "Users can update own followups"
  ON public.checkin_followups FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-create follow-up 30 min after check-in
CREATE OR REPLACE FUNCTION public.create_checkin_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_entity_name TEXT;
BEGIN
  -- Get entity name
  IF NEW.merchant_id IS NOT NULL THEN
    SELECT business_name INTO v_entity_name FROM merchants WHERE id = NEW.merchant_id;
  ELSIF NEW.vet_id IS NOT NULL THEN
    SELECT clinic_name INTO v_entity_name FROM partner_vets WHERE id = NEW.vet_id;
  END IF;

  IF v_entity_name IS NULL THEN
    v_entity_name := 'this location';
  END IF;

  INSERT INTO checkin_followups (checkin_id, user_id, merchant_id, vet_id, entity_name, notify_at)
  VALUES (NEW.id, NEW.user_id, NEW.merchant_id, NEW.vet_id, v_entity_name, NEW.checked_in_at + INTERVAL '30 minutes');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_checkin_followup
  AFTER INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.create_checkin_followup();

-- Timestamp trigger
CREATE TRIGGER update_checkin_followups_updated_at
  BEFORE UPDATE ON public.checkin_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
