-- Allow anonymous users to view active lost pet posts for fast reunion
-- This is intentional as per feature requirements - contact info must be public
CREATE POLICY "Anyone can view active lost pet posts"
ON public.lost_pet_posts
FOR SELECT
TO anon
USING (is_active = true AND status = 'lost');

-- Grant access to the reviewer_profiles view for anonymous users
-- This allows public display of reviewer names on merchant profiles
GRANT SELECT ON public.reviewer_profiles TO anon;

-- Grant access to merchant_reviews_public view for anonymous users
GRANT SELECT ON public.merchant_reviews_public TO anon;