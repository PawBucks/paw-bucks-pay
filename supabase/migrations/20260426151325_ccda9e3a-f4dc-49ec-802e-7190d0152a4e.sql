CREATE TABLE IF NOT EXISTS public.vaccine_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  vaccination_id uuid NOT NULL,
  milestone text NOT NULL, -- 'upcoming_14','upcoming_7','upcoming_1','overdue'
  channel text NOT NULL,    -- 'email','sms','in_app'
  next_due_date date,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vaccination_id, milestone, channel)
);

CREATE INDEX IF NOT EXISTS idx_vaccine_reminder_log_user ON public.vaccine_reminder_log (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_vaccine_reminder_log_pet ON public.vaccine_reminder_log (pet_id);

ALTER TABLE public.vaccine_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their reminder history"
  ON public.vaccine_reminder_log FOR SELECT
  USING (auth.uid() = user_id);