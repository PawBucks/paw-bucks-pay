
-- =============================================
-- SCHEDULING SYSTEM UPGRADE - Phase 1
-- =============================================

-- 1. Add buffer time and booking notice to merchant_services
ALTER TABLE public.merchant_services 
ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_notice_hours INTEGER NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS allow_recurring BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS cancellation_policy_hours INTEGER NOT NULL DEFAULT 24;

-- 2. Create booking intake questions table
CREATE TABLE public.booking_intake_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.merchant_services(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text' CHECK (question_type IN ('text', 'textarea', 'select', 'checkbox', 'radio')),
  options JSONB DEFAULT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_intake_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage their intake questions"
ON public.booking_intake_questions FOR ALL
USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Public can view active intake questions"
ON public.booking_intake_questions FOR SELECT
USING (is_active = true);

-- 3. Create booking intake answers table
CREATE TABLE public.booking_intake_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.booking_intake_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_intake_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own answers"
ON public.booking_intake_answers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.service_bookings sb 
  WHERE sb.id = booking_id AND sb.user_id = auth.uid()
));

CREATE POLICY "Users can create answers for their bookings"
ON public.booking_intake_answers FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.service_bookings sb 
  WHERE sb.id = booking_id AND sb.user_id = auth.uid()
));

CREATE POLICY "Merchants can view answers for their bookings"
ON public.booking_intake_answers FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.service_bookings sb 
  WHERE sb.id = booking_id AND public.user_owns_merchant(sb.merchant_id)
));

-- 4. Create booking waitlist table
CREATE TABLE public.booking_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.merchant_services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time_start TEXT,
  preferred_time_end TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired', 'cancelled')),
  notified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own waitlist entries"
ON public.booking_waitlist FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Merchants view their waitlist"
ON public.booking_waitlist FOR SELECT
USING (public.user_owns_merchant(merchant_id));

-- 5. Add recurring booking fields to service_bookings
ALTER TABLE public.service_bookings
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_interval TEXT CHECK (recurring_interval IN ('weekly', 'biweekly', 'monthly')),
ADD COLUMN IF NOT EXISTS recurring_end_date DATE,
ADD COLUMN IF NOT EXISTS recurring_parent_id UUID REFERENCES public.service_bookings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS rescheduled_from_id UUID REFERENCES public.service_bookings(id) ON DELETE SET NULL;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_booking_intake_questions_merchant ON public.booking_intake_questions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_booking_intake_questions_service ON public.booking_intake_questions(service_id);
CREATE INDEX IF NOT EXISTS idx_booking_intake_answers_booking ON public.booking_intake_answers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_waitlist_merchant_date ON public.booking_waitlist(merchant_id, preferred_date);
CREATE INDEX IF NOT EXISTS idx_booking_waitlist_user ON public.booking_waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_recurring ON public.service_bookings(recurring_parent_id) WHERE recurring_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_bookings_user_status ON public.service_bookings(user_id, status);

-- 7. Add updated_at triggers
CREATE TRIGGER update_booking_intake_questions_updated_at
BEFORE UPDATE ON public.booking_intake_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_booking_waitlist_updated_at
BEFORE UPDATE ON public.booking_waitlist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
