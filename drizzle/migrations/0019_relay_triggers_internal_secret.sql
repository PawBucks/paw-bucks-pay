CREATE OR REPLACE FUNCTION public.lost_pet_alert_broadcast_relay()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
declare _secret text;
begin
  begin
    select value into _secret from private.system_config where key = 'internal_trigger_secret';
    perform net.http_post(
      url := 'https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/broadcast-lost-pet-alert',
      body := jsonb_build_object('postId', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', coalesce(_secret, '')),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'lost_pet_alert_broadcast_relay failed: %', sqlerrm;
  end;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notifications_push_relay()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
declare _secret text;
begin
begin
  select value into _secret from private.system_config where key = 'internal_trigger_secret';
  perform net.http_post(
    url := 'https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/notify-push',
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', coalesce(_secret, '')),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'notifications_push_relay failed: %', sqlerrm;
end;
return new;
end;
$function$;