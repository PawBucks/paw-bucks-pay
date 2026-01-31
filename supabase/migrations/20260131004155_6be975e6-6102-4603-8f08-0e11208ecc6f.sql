-- Fix merchant_reviews_public view to use security_invoker
DROP VIEW IF EXISTS public.merchant_reviews_public;
CREATE VIEW public.merchant_reviews_public
WITH (security_invoker = on) AS
SELECT 
    mr.id,
    mr.merchant_id,
    mr.rating,
    mr.review_text,
    mr.created_at,
    mr.updated_at,
    p.full_name AS reviewer_name,
    p.avatar_url AS reviewer_avatar
FROM merchant_reviews mr
LEFT JOIN profiles p ON p.id = mr.user_id
WHERE mr.review_text IS NOT NULL OR mr.rating IS NOT NULL;

-- Grant access to anonymous users
GRANT SELECT ON public.merchant_reviews_public TO anon;
GRANT SELECT ON public.merchant_reviews_public TO authenticated;