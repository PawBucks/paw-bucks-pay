-- Compliance Reminders System
CREATE TABLE public.compliance_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE CASCADE NOT NULL,
  vet_id UUID REFERENCES public.partner_vets(id) ON DELETE CASCADE NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('vaccination', 'heartworm_test', 'annual_exam', 'dental_cleaning', 'flea_tick', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  recurrence_months INTEGER,
  is_active BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reminder Send Log
CREATE TABLE public.compliance_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID REFERENCES public.compliance_reminders(id) ON DELETE CASCADE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'push', 'email')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT
);

-- Prescription Refill Requests
CREATE TABLE public.prescription_refill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  vet_id UUID REFERENCES public.partner_vets(id) ON DELETE CASCADE NOT NULL,
  medication_name TEXT NOT NULL,
  current_dosage TEXT,
  quantity_requested INTEGER DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'fulfilled')),
  vet_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  fulfillment_type TEXT CHECK (fulfillment_type IN ('pawbucks_store', 'partner_pharmacy', 'in_clinic', 'other')),
  fulfillment_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Secure Message Attachments (for photo sharing)
CREATE TABLE public.vet_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.vet_messages(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'document', 'other')),
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add read status to vet_messages if not exists
ALTER TABLE public.vet_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.vet_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE public.compliance_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_refill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_message_attachments ENABLE ROW LEVEL SECURITY;

-- Compliance Reminders Policies
CREATE POLICY "Vets can manage their reminders"
ON public.compliance_reminders FOR ALL
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Pet owners can view reminders for their pets"
ON public.compliance_reminders FOR SELECT
USING (pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid()));

-- Reminder Logs Policies
CREATE POLICY "Vets can view reminder logs"
ON public.compliance_reminder_logs FOR SELECT
USING (reminder_id IN (
  SELECT id FROM public.compliance_reminders 
  WHERE vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
));

-- Prescription Refill Policies
CREATE POLICY "Pet owners can create refill requests for their pets"
ON public.prescription_refill_requests FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Pet owners can view their refill requests"
ON public.prescription_refill_requests FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Vets can view and manage refill requests"
ON public.prescription_refill_requests FOR ALL
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- Message Attachments Policies
CREATE POLICY "Users can view attachments for their messages"
ON public.vet_message_attachments FOR SELECT
USING (message_id IN (
  SELECT id FROM public.vet_messages WHERE user_id = auth.uid()
));

CREATE POLICY "Vets can view attachments for their messages"
ON public.vet_message_attachments FOR SELECT
USING (message_id IN (
  SELECT vm.id FROM public.vet_messages vm
  JOIN public.partner_vets pv ON pv.id = vm.vet_id
  WHERE pv.user_id = auth.uid()
));

CREATE POLICY "Users can add attachments to their messages"
ON public.vet_message_attachments FOR INSERT
WITH CHECK (message_id IN (
  SELECT id FROM public.vet_messages WHERE user_id = auth.uid() AND sender_type = 'owner'
));

CREATE POLICY "Vets can add attachments to their messages"
ON public.vet_message_attachments FOR INSERT
WITH CHECK (message_id IN (
  SELECT vm.id FROM public.vet_messages vm
  JOIN public.partner_vets pv ON pv.id = vm.vet_id
  WHERE pv.user_id = auth.uid() AND vm.sender_type = 'vet'
));

-- Indexes for performance
CREATE INDEX idx_compliance_reminders_pet ON public.compliance_reminders(pet_id);
CREATE INDEX idx_compliance_reminders_vet ON public.compliance_reminders(vet_id);
CREATE INDEX idx_compliance_reminders_due ON public.compliance_reminders(due_date) WHERE is_active = true;
CREATE INDEX idx_compliance_reminders_next ON public.compliance_reminders(next_reminder_at) WHERE is_active = true;
CREATE INDEX idx_prescription_refills_pet ON public.prescription_refill_requests(pet_id);
CREATE INDEX idx_prescription_refills_vet ON public.prescription_refill_requests(vet_id);
CREATE INDEX idx_prescription_refills_status ON public.prescription_refill_requests(status);
CREATE INDEX idx_vet_messages_unread ON public.vet_messages(vet_id, is_read) WHERE is_read = false;

-- Trigger for updated_at
CREATE TRIGGER update_compliance_reminders_updated_at
  BEFORE UPDATE ON public.compliance_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prescription_refills_updated_at
  BEFORE UPDATE ON public.prescription_refill_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();