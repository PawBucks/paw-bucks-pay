-- Coordinates for lost pet flyers (used for 10-mile radius alert targeting)
ALTER TABLE public.lost_pet_posts
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);

-- Last known coordinates for platform users (browser/device location, opt-in)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_known_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS last_known_longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS last_location_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_known_location
  ON public.profiles (last_known_latitude, last_known_longitude)
  WHERE last_known_latitude IS NOT NULL AND last_known_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lost_pet_posts_location
  ON public.lost_pet_posts (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Async relay: fire the geo-filtered broadcast when a new lost flyer is posted
CREATE OR REPLACE FUNCTION public.lost_pet_alert_broadcast_relay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $function$
begin
  begin
    perform net.http_post(
      url := 'https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1/broadcast-lost-pet-alert',
      body := jsonb_build_object('postId', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'lost_pet_alert_broadcast_relay failed: %', sqlerrm;
  end;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS lost_pet_posts_broadcast_alert ON public.lost_pet_posts;
CREATE TRIGGER lost_pet_posts_broadcast_alert
AFTER INSERT ON public.lost_pet_posts
FOR EACH ROW
WHEN (NEW.status = 'lost' AND NEW.is_active = true)
EXECUTE FUNCTION public.lost_pet_alert_broadcast_relay();
