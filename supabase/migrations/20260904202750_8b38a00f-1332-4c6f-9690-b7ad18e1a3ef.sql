CREATE OR REPLACE FUNCTION public.send_pet_fund_expiry_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reminder_count integer := 0;
  v_record RECORD;
  v_reminder_days integer[] := ARRAY[14, 7, 1];
  v_day integer;
  v_title text;
  v_message text;
  v_usd numeric;
BEGIN
  FOREACH v_day IN ARRAY v_reminder_days
  LOOP
    FOR v_record IN
      SELECT
        pfr.user_id,
        SUM(pfr.amount) as total_amount,
        MIN(pfr.expires_at) as earliest_expiry,
        array_agg(pfr.id) as release_ids
      FROM pet_fund_releases pfr
      WHERE pfr.status = 'released'
        AND pfr.used_at IS NULL
        AND pfr.expires_at IS NOT NULL
        AND pfr.expires_at > now()
        AND pfr.expires_at <= now() + (v_day || ' days')::interval
        AND NOT (COALESCE(pfr.expiry_reminder_sent_days, '{}') @> ARRAY[v_day])
        AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = pfr.user_id)
      GROUP BY pfr.user_id
    LOOP
      v_usd := (v_record.total_amount::numeric) / 1000;

      IF v_day = 1 THEN
        v_title := 'Pet Fund / Welcome Credits Expiring Tomorrow!';
        v_message := '$' || v_usd || ' worth of promotional credits expire tomorrow. Apply them at checkout before they''re gone!';
      ELSIF v_day = 7 THEN
        v_title := 'Pet Fund / Welcome Credits Expiring in 7 Days';
        v_message := '$' || v_usd || ' worth of promotional credits expire in 7 days. Use them at any partner merchant!';
      ELSE
        v_title := 'Pet Fund / Welcome Credits Expiring Soon';
        v_message := '$' || v_usd || ' worth of promotional credits expire in 14 days. Plan a visit to your favorite partner!';
      END IF;

      BEGIN
        INSERT INTO notifications (user_id, title, message, category)
        VALUES (v_record.user_id, v_title, v_message, 'transactional');

        UPDATE pet_fund_releases
        SET expiry_reminder_sent_days = array_append(COALESCE(expiry_reminder_sent_days, '{}'), v_day)
        WHERE id = ANY(v_record.release_ids);

        v_reminder_count := v_reminder_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Skipped pet fund expiry reminder for user %: %', v_record.user_id, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  RETURN v_reminder_count;
END;
$function$;