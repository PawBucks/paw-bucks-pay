
DROP VIEW IF EXISTS public.lost_pet_posts_public;

DROP POLICY IF EXISTS "Public can view active lost pet posts" ON public.lost_pet_posts;

CREATE POLICY "Authenticated can view active lost pet posts"
  ON public.lost_pet_posts
  FOR SELECT
  TO authenticated
  USING (is_active = true AND status = 'active');

CREATE VIEW public.lost_pet_posts_public
WITH (security_invoker = off) AS
SELECT
  id, user_id, pet_name, pet_type, breed, color_markings, size,
  age_estimate, gender, collar_description, identifying_features,
  photo_url, photo_urls, last_seen_location, last_seen_date, last_seen_time,
  last_seen_area_description, contact_name, contact_phone, contact_email,
  reward_amount, additional_notes, status, is_active, created_at, updated_at,
  deletion_warning_sent_at
FROM public.lost_pet_posts
WHERE is_active = true AND status = 'active';

GRANT SELECT ON public.lost_pet_posts_public TO anon, authenticated;
