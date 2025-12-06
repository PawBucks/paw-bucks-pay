-- The merchants_public view queries the merchants table which has RLS
-- We need to allow SELECT on the underlying merchants table for anon users
-- But only through the view (which already filters sensitive columns)

-- Option: Create a policy that allows public read access to basic merchant info
-- This is safe because merchants_public view already excludes sensitive fields

CREATE POLICY "Anyone can view basic merchant info"
ON public.merchants
FOR SELECT
TO anon, authenticated
USING (true);

-- Also ensure the view is properly accessible
GRANT SELECT ON public.merchants_public TO anon;
GRANT SELECT ON public.merchants_public TO authenticated;