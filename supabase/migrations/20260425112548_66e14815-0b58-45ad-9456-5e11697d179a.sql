-- Replace the daily merchant subscription billing cron with an hourly catch-up.
-- The edge function processes any subscription where next_billing_date <= now(),
-- so running hourly automatically catches anything missed since the last run.

SELECT cron.unschedule('process-merchant-subscriptions-daily');

SELECT cron.schedule(
  'process-merchant-subscriptions-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/process-merchant-subscriptions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4cG5raXBjb3hrc21uc3ZwdndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTY1NDMsImV4cCI6MjA3NzA5MjU0M30.M6DcSiEdhjMT_hl-KH_vKODyyb8d6MtmsUYK5-Vlooo"}'::jsonb,
    body := '{"triggered_by": "cron_hourly"}'::jsonb
  ) AS request_id;
  $$
);