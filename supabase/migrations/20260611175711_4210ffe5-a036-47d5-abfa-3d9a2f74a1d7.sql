
-- Remove the table-level anon SELECT we briefly added (re-exposed PII)
DROP POLICY IF EXISTS "Public can view active lost pet posts (no PII via view)" ON public.lost_pet_posts;

-- Recreate views WITHOUT security_invoker so they expose only safe columns
DROP VIEW IF EXISTS public.lost_pet_posts_public;
CREATE VIEW public.lost_pet_posts_public AS
SELECT
  id, user_id, pet_name, pet_type, breed, color_markings, size, age_estimate, gender,
  collar_description, identifying_features, photo_url, photo_urls,
  last_seen_location, last_seen_date, last_seen_time, last_seen_area_description,
  reward_amount, additional_notes, status, is_active,
  created_at, updated_at, deletion_warning_sent_at
FROM public.lost_pet_posts
WHERE is_active = true AND status <> 'reunited';
ALTER VIEW public.lost_pet_posts_public SET (security_invoker = true);
-- Owner / public-safe rows are visible via the existing RLS — add a column-safe anon read:
DROP POLICY IF EXISTS "Anon can read non-PII active lost pet posts" ON public.lost_pet_posts;
-- Keep table itself restricted; instead grant select through a SECURITY DEFINER wrapper view.
ALTER VIEW public.lost_pet_posts_public SET (security_invoker = false);
GRANT SELECT ON public.lost_pet_posts_public TO anon, authenticated;

DROP VIEW IF EXISTS public.founding_50_badges_public;
CREATE VIEW public.founding_50_badges_public AS
SELECT entity_type, entity_id, badge_number, awarded_at
FROM public.founding_50_badges;
GRANT SELECT ON public.founding_50_badges_public TO anon, authenticated;

-- Make sure the contact lookup is only callable by signed-in users
REVOKE EXECUTE ON FUNCTION public.get_lost_pet_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lost_pet_contact(uuid) TO authenticated;
