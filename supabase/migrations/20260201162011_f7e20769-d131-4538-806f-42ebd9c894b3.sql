
-- =========================================================
-- SECURITY FIX PART 3: Fix reviewer_profiles view
-- =========================================================

DROP VIEW IF EXISTS public.reviewer_profiles;

CREATE VIEW public.reviewer_profiles
WITH (security_invoker = on)
AS
SELECT DISTINCT
    p.id,
    p.full_name,
    p.avatar_url
FROM profiles p
WHERE EXISTS (
    SELECT 1 FROM merchant_reviews mr WHERE mr.user_id = p.id
);

COMMENT ON VIEW public.reviewer_profiles IS 
'Public reviewer info for reviews - only shows users who have left reviews. SECURITY INVOKER respects underlying RLS.';
