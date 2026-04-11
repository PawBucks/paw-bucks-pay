
-- Grooming rebook settings per merchant
CREATE TABLE public.grooming_rebook_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  rebook_interval_days INTEGER NOT NULL DEFAULT 42,
  message_template TEXT NOT NULL DEFAULT 'Hi {{owner_name}}, it''s been a while since {{pet_name}}''s last grooming! We have openings available. Book now to keep {{pet_name}} looking great!',
  max_reminders_per_cycle INTEGER NOT NULL DEFAULT 2,
  reminder_channels JSONB NOT NULL DEFAULT '["push","email"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id)
);

ALTER TABLE public.grooming_rebook_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own rebook settings"
  ON public.grooming_rebook_settings FOR SELECT
  TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can insert own rebook settings"
  ON public.grooming_rebook_settings FOR INSERT
  TO authenticated
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update own rebook settings"
  ON public.grooming_rebook_settings FOR UPDATE
  TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- Rebook log tracks sent reminders and outcomes
CREATE TABLE public.grooming_rebook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE SET NULL,
  last_booking_id UUID REFERENCES public.service_bookings(id) ON DELETE SET NULL,
  message_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'sent',
  rebook_booking_id UUID REFERENCES public.service_bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grooming_rebook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own rebook logs"
  ON public.grooming_rebook_log FOR SELECT
  TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- Index for efficient querying
CREATE INDEX idx_rebook_log_merchant_status ON public.grooming_rebook_log(merchant_id, status);
CREATE INDEX idx_rebook_log_user_merchant ON public.grooming_rebook_log(user_id, merchant_id);

-- Timestamp triggers
CREATE TRIGGER update_grooming_rebook_settings_updated_at
  BEFORE UPDATE ON public.grooming_rebook_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grooming_rebook_log_updated_at
  BEFORE UPDATE ON public.grooming_rebook_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
