-- Fix 1: Allow anonymous users to view reviewer names for public reviews
-- This is required so anonymous visitors can see who left reviews on merchant pages
DROP POLICY IF EXISTS "Authenticated users can view reviewer basic info" ON public.profiles;

CREATE POLICY "Anyone can view reviewer basic info"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM merchant_reviews mr WHERE mr.user_id = profiles.id
    )
  );

-- Fix 2: Update lost pet posts policy to allow viewing ALL active posts (not just 'lost' status)
-- This ensures 'found' and 'reunited' posts are also publicly visible for flyer purposes
DROP POLICY IF EXISTS "Anyone can view active lost pet posts" ON public.lost_pet_posts;

CREATE POLICY "Anyone can view active lost pet posts"
  ON public.lost_pet_posts
  FOR SELECT
  USING (is_active = true);