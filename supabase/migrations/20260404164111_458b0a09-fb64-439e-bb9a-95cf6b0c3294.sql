
-- Create platform notification settings table
CREATE TABLE public.platform_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_notification_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read and write
CREATE POLICY "Admins can manage notification settings"
ON public.platform_notification_settings
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Seed notification settings
INSERT INTO public.platform_notification_settings (setting_key, setting_value, description) VALUES
  ('email_notifications_enabled', 'true'::jsonb, 'Master toggle for platform email notifications'),
  ('push_notifications_enabled', 'true'::jsonb, 'Master toggle for push notifications'),
  ('sms_notifications_enabled', 'false'::jsonb, 'Master toggle for SMS notifications via Twilio'),
  ('low_balance_alert_threshold', '1000'::jsonb, 'PawBucks balance threshold for low balance alerts'),
  ('booking_reminder_hours', '24'::jsonb, 'Hours before booking to send reminder'),
  ('merchant_payout_notification', 'true'::jsonb, 'Notify merchants on payout events');

-- Add feature toggle settings if not exist
INSERT INTO public.platform_settings (key, value) VALUES
  ('pet_fund_enabled', '{"description":"Enable/disable Pet Fund program","enabled":true}'::jsonb),
  ('referrals_enabled', '{"description":"Enable/disable referral program","enabled":true}'::jsonb),
  ('merchant_marketplace_enabled', '{"description":"Enable/disable merchant marketplace","enabled":true}'::jsonb),
  ('pawbucks_enabled', '{"description":"Enable/disable PawBucks rewards","enabled":true}'::jsonb),
  ('payout_schedule', '{"description":"Merchant payout schedule","schedule":"daily"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
BEFORE UPDATE ON public.platform_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
