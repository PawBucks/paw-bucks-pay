-- Fix 1 & 2: Create a public view for lost_pet_posts that hides sensitive contact info
-- This allows public viewing of lost pets while protecting owner privacy

-- First, drop existing policies that expose all data publicly
DROP POLICY IF EXISTS "Anyone can view active lost pet posts" ON public.lost_pet_posts;

-- Create a public view that exposes only safe fields
CREATE OR REPLACE VIEW public.lost_pet_posts_public AS
SELECT
    id,
    pet_name,
    pet_type,
    breed,
    color_markings,
    size,
    gender,
    age_estimate,
    last_seen_date,
    last_seen_time,
    last_seen_location,
    last_seen_area_description,
    identifying_features,
    collar_description,
    photo_url,
    photo_urls,
    reward_amount,
    additional_notes,
    status,
    is_active,
    created_at,
    updated_at
    -- Excluded: contact_phone, contact_email, contact_name, microchip_number
FROM public.lost_pet_posts
WHERE is_active = true;

-- Grant access to the public view
GRANT SELECT ON public.lost_pet_posts_public TO anon, authenticated;

-- Add comment explaining the view
COMMENT ON VIEW public.lost_pet_posts_public IS 'Public view of lost pet posts that excludes sensitive contact information and microchip numbers';

-- Create RLS policy so only authenticated users can see contact info (via base table)
CREATE POLICY "Authenticated users can view all active lost pet posts"
ON public.lost_pet_posts
FOR SELECT
TO authenticated
USING (is_active = true);

-- Post owners can always see their own posts
CREATE POLICY "Users can view their own lost pet posts"
ON public.lost_pet_posts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix 3: Add explicit policies to irs_mileage_rates to prevent tampering
-- First, enable RLS if not already enabled
ALTER TABLE public.irs_mileage_rates ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read IRS rates (they are public reference data)
CREATE POLICY "Anyone can read IRS mileage rates"
ON public.irs_mileage_rates
FOR SELECT
USING (true);

-- Only service role can insert/update/delete (no regular user policies)
-- This is handled by NOT creating insert/update/delete policies for regular users
-- Service role bypasses RLS automatically

COMMENT ON TABLE public.irs_mileage_rates IS 'Official IRS mileage rates - read-only for users, write access restricted to service role only';