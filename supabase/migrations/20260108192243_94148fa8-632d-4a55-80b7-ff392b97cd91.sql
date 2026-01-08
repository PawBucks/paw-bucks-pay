-- Create a public view for merchant reviews that hides raw user_ids
-- but still allows displaying reviewer names
CREATE OR REPLACE VIEW public.merchant_reviews_public AS
SELECT 
  mr.id,
  mr.merchant_id,
  mr.rating,
  mr.review_text,
  mr.created_at,
  mr.updated_at,
  p.full_name as reviewer_name,
  p.avatar_url as reviewer_avatar
FROM public.merchant_reviews mr
LEFT JOIN public.profiles p ON p.id = mr.user_id
WHERE mr.review_text IS NOT NULL OR mr.rating IS NOT NULL;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.merchant_reviews_public IS 'Public view of merchant reviews that displays reviewer info without exposing raw user_ids';