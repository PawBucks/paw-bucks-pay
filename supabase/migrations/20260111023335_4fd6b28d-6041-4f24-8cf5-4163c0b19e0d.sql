-- Create a public view for lost pet posts that hides contact information
-- This protects PII while still allowing public visibility of lost pet alerts

CREATE OR REPLACE VIEW public.lost_pet_posts_public AS
SELECT 
  id,
  pet_name,
  pet_type,
  breed,
  color_markings,
  size,
  age_estimate,
  gender,
  collar_description,
  identifying_features,
  last_seen_location,
  last_seen_area_description,
  last_seen_date,
  last_seen_time,
  photo_url,
  photo_urls,
  reward_amount,
  microchip_number,
  status,
  is_active,
  created_at,
  updated_at,
  user_id
  -- Excluded: contact_name, contact_phone, contact_email
FROM public.lost_pet_posts
WHERE is_active = true;

-- Grant public access to the view
GRANT SELECT ON public.lost_pet_posts_public TO anon;
GRANT SELECT ON public.lost_pet_posts_public TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.lost_pet_posts_public IS 'Public view of lost pet posts that excludes contact PII. Use this for unauthenticated/public listings.';

-- Update the RLS policy to require authentication for viewing contact details
-- First drop the old permissive policy
DROP POLICY IF EXISTS "Anyone can view active lost pet posts" ON public.lost_pet_posts;

-- Create a new policy that only allows authenticated users to view full details
CREATE POLICY "Authenticated users can view active lost pet posts"
ON public.lost_pet_posts
FOR SELECT
USING (
  is_active = true 
  AND (
    auth.uid() IS NOT NULL  -- Authenticated users can see all active posts
    OR user_id = auth.uid()  -- Owner can always see their own posts
  )
);

-- Keep the owner policy for managing their own posts
DROP POLICY IF EXISTS "Users can manage their own lost pet posts" ON public.lost_pet_posts;

CREATE POLICY "Users can manage their own lost pet posts"
ON public.lost_pet_posts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);