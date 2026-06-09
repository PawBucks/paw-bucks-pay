-- Remove broad authenticated SELECT policies on lost_pet_posts that exposed microchip_number.
-- Authenticated users should query lost_pet_posts_public (which omits microchip_number).
-- Direct base-table SELECT is now restricted to the post owner and admins.

DROP POLICY IF EXISTS "Authenticated can view active lost pet posts" ON public.lost_pet_posts;
DROP POLICY IF EXISTS "Authenticated users can view all active lost pet posts" ON public.lost_pet_posts;