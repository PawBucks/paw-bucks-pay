-- Add policy to allow viewing reviewer public info (for review attribution)
-- This allows only id, full_name, avatar_url to be accessed for users who have left reviews

CREATE POLICY "Public can view reviewer basic info"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
    -- Only allow access if user has left a review (is a reviewer)
    EXISTS (SELECT 1 FROM merchant_reviews mr WHERE mr.user_id = profiles.id)
);

-- Note: This policy allows reading all profile columns, but the reviewer_profiles view
-- only exposes id, full_name, and avatar_url. Application code should always use the view.