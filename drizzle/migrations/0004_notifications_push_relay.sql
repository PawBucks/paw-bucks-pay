create extension if not exists pg_net with schema extensions;

create or replace function public.notifications_push_relay()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
begin
begin
  perform net.http_post(
    url := 'https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/notify-push',
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'notifications_push_relay failed: %', sqlerrm;
end;
return new;
end;
$$;

revoke all on function public.notifications_push_relay() from public, anon, authenticated;

drop trigger if exists notifications_push_relay on public.notifications;
create trigger notifications_push_relay
after insert on public.notifications
for each row execute function public.notifications_push_relay();