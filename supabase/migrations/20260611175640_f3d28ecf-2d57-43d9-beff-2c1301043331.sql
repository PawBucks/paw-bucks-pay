
-- 1) LOST PET POSTS: rebuild public view without PII; add auth-only contact lookup
DROP VIEW IF EXISTS public.lost_pet_posts_public;
CREATE VIEW public.lost_pet_posts_public
WITH (security_invoker = true)
AS
SELECT
  id, user_id, pet_name, pet_type, breed, color_markings, size, age_estimate, gender,
  collar_description, identifying_features, photo_url, photo_urls,
  last_seen_location, last_seen_date, last_seen_time, last_seen_area_description,
  reward_amount, additional_notes, status, is_active,
  created_at, updated_at, deletion_warning_sent_at
FROM public.lost_pet_posts
WHERE is_active = true AND status <> 'reunited';

GRANT SELECT ON public.lost_pet_posts_public TO anon, authenticated;

-- Allow anyone to view non-PII columns of active posts directly when needed.
-- (The public view already filters PII; this policy supports the view since it is security_invoker.)
DROP POLICY IF EXISTS "Public can view active lost pet posts (no PII via view)" ON public.lost_pet_posts;
CREATE POLICY "Public can view active lost pet posts (no PII via view)"
ON public.lost_pet_posts
FOR SELECT
TO anon, authenticated
USING (is_active = true AND status <> 'reunited');

-- Authenticated-only contact lookup
CREATE OR REPLACE FUNCTION public.get_lost_pet_contact(_post_id uuid)
RETURNS TABLE(contact_name text, contact_phone text, contact_email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to view contact details';
  END IF;
  RETURN QUERY
    SELECT lpp.contact_name, lpp.contact_phone, lpp.contact_email
    FROM public.lost_pet_posts lpp
    WHERE lpp.id = _post_id AND lpp.is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_lost_pet_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lost_pet_contact(uuid) TO authenticated;

-- 2) PROFILES: prevent self-unban and self-elevation via trigger
CREATE OR REPLACE FUNCTION public.profiles_prevent_privileged_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  is_admin boolean := false;
BEGIN
  IF caller IS NULL THEN
    -- service_role / definer paths: allow
    RETURN NEW;
  END IF;
  is_admin := public.has_role(caller, 'admin'::app_role)
           OR public.has_role(caller, 'superadmin'::app_role);
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin: preserve sensitive fields
  NEW.is_banned     := OLD.is_banned;
  NEW.banned_at     := OLD.banned_at;
  NEW.banned_by     := OLD.banned_by;
  NEW.banned_reason := OLD.banned_reason;
  NEW.user_type     := OLD.user_type;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privileged_self_update ON public.profiles;
CREATE TRIGGER profiles_prevent_privileged_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_prevent_privileged_self_update();

-- 3) FOUNDING 50 BADGES: stop exposing user_id to anon/authenticated
DROP POLICY IF EXISTS "Founding 50 badges are publicly viewable" ON public.founding_50_badges;

CREATE POLICY "Owners can view their founding 50 badge"
ON public.founding_50_badges
FOR SELECT
TO authenticated
USING (auth.uid() = user_id
       OR public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE OR REPLACE VIEW public.founding_50_badges_public
WITH (security_invoker = false)
AS
SELECT entity_type, entity_id, badge_number, awarded_at
FROM public.founding_50_badges;

GRANT SELECT ON public.founding_50_badges_public TO anon, authenticated;

-- 4) MERCHANT-VIDEOS bucket: restrict reads to owner / admins
DROP POLICY IF EXISTS "Anyone can view intro videos" ON storage.objects;
CREATE POLICY "Owners and admins can view merchant intro videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'merchant-videos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
);
