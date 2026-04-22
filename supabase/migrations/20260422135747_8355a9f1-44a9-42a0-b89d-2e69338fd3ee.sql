-- Remove the unsafe public SELECT policy that exposes ALL lost pet posts (including PII) due to OR true
DROP POLICY IF EXISTS "Anyone can view active lost pet posts" ON public.lost_pet_posts;

-- Replace with a properly scoped public SELECT policy: only genuinely active posts
CREATE POLICY "Public can view active lost pet posts"
ON public.lost_pet_posts
FOR SELECT
TO anon, authenticated
USING (is_active = true AND status = 'active');