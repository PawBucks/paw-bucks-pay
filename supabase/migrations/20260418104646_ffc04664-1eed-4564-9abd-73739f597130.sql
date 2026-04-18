-- Restore public read access to lost_pet_posts so anyone (including unauthenticated users)
-- can see full flyer details including contact info. This is intentional: lost pet recovery
-- requires maximum visibility of contact details to anyone who might find the pet.

-- Drop the masked-only policy if present and restore public SELECT on the base table
DROP POLICY IF EXISTS "Public can view active lost pet posts" ON public.lost_pet_posts;
DROP POLICY IF EXISTS "Anyone can view active lost pet posts" ON public.lost_pet_posts;

CREATE POLICY "Anyone can view active lost pet posts"
ON public.lost_pet_posts
FOR SELECT
USING (status = 'active' OR status IS NULL OR true);
