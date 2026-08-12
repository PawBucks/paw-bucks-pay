SELECT cron.unschedule('pet-fund-monthly-release');
SELECT cron.schedule(
  'pet-fund-monthly-release',
  '5 * * * *',
  $$SELECT private.invoke_edge_function('pet-fund-monthly-release', jsonb_build_object('scheduled_at', now()));$$
);