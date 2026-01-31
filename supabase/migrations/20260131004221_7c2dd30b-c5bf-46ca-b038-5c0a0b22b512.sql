-- Fix remaining views to use security_invoker

-- Fix consultation_slot_availability
DROP VIEW IF EXISTS public.consultation_slot_availability;
CREATE VIEW public.consultation_slot_availability
WITH (security_invoker = on) AS
SELECT 
    booking_date,
    time_slot,
    count(*) AS bookings_count
FROM consultation_bookings
WHERE status = ANY (ARRAY['pending'::text, 'confirmed'::text])
GROUP BY booking_date, time_slot;

-- Fix merchant_active_services_public
DROP VIEW IF EXISTS public.merchant_active_services_public;
CREATE VIEW public.merchant_active_services_public
WITH (security_invoker = on) AS
SELECT 
    msp.merchant_id,
    msp.service_id,
    mms.name AS service_name,
    msp.status,
    msp.expires_at
FROM merchant_service_purchases msp
JOIN merchant_market_services mms ON mms.id = msp.service_id
WHERE msp.status = 'active' 
AND (msp.expires_at IS NULL OR msp.expires_at > now());

-- Fix lost_pet_posts_public - INCLUDE contact info for fast reunion
-- This is intentional per feature requirements
DROP VIEW IF EXISTS public.lost_pet_posts_public;
CREATE VIEW public.lost_pet_posts_public
WITH (security_invoker = on) AS
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
    updated_at,
    -- Include contact info for public visibility to enable fast reunion
    contact_name,
    contact_phone,
    contact_email
FROM lost_pet_posts
WHERE is_active = true AND status = 'lost';

-- Grant access
GRANT SELECT ON public.lost_pet_posts_public TO anon;
GRANT SELECT ON public.lost_pet_posts_public TO authenticated;
GRANT SELECT ON public.consultation_slot_availability TO anon;
GRANT SELECT ON public.consultation_slot_availability TO authenticated;
GRANT SELECT ON public.merchant_active_services_public TO anon;
GRANT SELECT ON public.merchant_active_services_public TO authenticated;