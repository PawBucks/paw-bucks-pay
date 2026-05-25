-- Switch the five timezone-sensitive cron jobs to hourly UTC.
-- Each corresponding edge function now gates on the recipient's local
-- hour internally, so the desired wall-clock delivery time is honored
-- per-user (and DST changes no longer cause drift).
SELECT cron.alter_job(17, schedule => '0 * * * *'); -- merchant-daily-summary  (was 0 1 * * *)
SELECT cron.alter_job(37, schedule => '0 * * * *'); -- process-grooming-rebooks-daily  (was 0 14 * * *)
SELECT cron.alter_job(41, schedule => '0 * * * *'); -- send-invoice-reminders  (was 0 9 * * *)
SELECT cron.alter_job(42, schedule => '0 * * * *'); -- send-lost-pet-deletion-warnings-daily  (was 0 9 * * *)
SELECT cron.alter_job(43, schedule => '0 * * * *'); -- send-vaccine-reminders-daily  (was 0 13 * * *)