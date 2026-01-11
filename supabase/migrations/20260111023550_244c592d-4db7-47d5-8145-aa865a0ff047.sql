-- Revert: Allow public access to lost pet posts including contact info
-- This is an intentional business decision to enable pet recovery

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Authenticated users can view active lost pet posts" ON public.lost_pet_posts;

-- Restore the public access policy
CREATE POLICY "Anyone can view active lost pet posts"
ON public.lost_pet_posts
FOR SELECT
USING (is_active = true);

-- Drop the public view since we're exposing contact info publicly
DROP VIEW IF EXISTS public.lost_pet_posts_public;

-- Keep the owner management policy
DROP POLICY IF EXISTS "Users can manage their own lost pet posts" ON public.lost_pet_posts;

CREATE POLICY "Users can manage their own lost pet posts"
ON public.lost_pet_posts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);