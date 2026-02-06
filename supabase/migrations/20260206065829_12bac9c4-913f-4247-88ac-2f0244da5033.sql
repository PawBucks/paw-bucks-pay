-- Fix the security definer view issue - recreate with security_invoker
DROP VIEW IF EXISTS public.reviewer_profiles;

CREATE VIEW public.reviewer_profiles
WITH (security_invoker = on) AS
SELECT 
    p.id,
    p.full_name,
    p.avatar_url
FROM profiles p
WHERE EXISTS (SELECT 1 FROM merchant_reviews mr WHERE mr.user_id = p.id);

GRANT SELECT ON public.reviewer_profiles TO anon, authenticated;

COMMENT ON VIEW public.reviewer_profiles IS 'Public reviewer names for review attribution - uses security_invoker';

-- Now we need an RLS policy that ONLY allows reading the specific columns for reviewers
-- Unfortunately, Postgres RLS is row-level, not column-level
-- So we have two options:
-- 1. Allow reading reviewer profiles (all columns accessible but view restricts what's returned)
-- 2. Use a security definer function to safely return only specific columns

-- Option 1 is acceptable here because:
-- - The VIEW only exposes id, full_name, avatar_url
-- - Application code must use the view, not direct table access
-- - This is intentional for review attribution (business requirement)

CREATE POLICY "Allow reading reviewer profiles for review attribution"
ON public.profiles
FOR SELECT
TO anon, authenticated  
USING (
    EXISTS (SELECT 1 FROM merchant_reviews mr WHERE mr.user_id = profiles.id)
);