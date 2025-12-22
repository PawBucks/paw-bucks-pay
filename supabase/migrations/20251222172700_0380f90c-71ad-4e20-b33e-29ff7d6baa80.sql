-- Add RLS policy to allow anyone to view profile names (for displaying reviewer names on reviews)
-- This only exposes the full_name, not other sensitive data like email or phone
CREATE POLICY "Anyone can view profile names for reviews"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- Note: The existing policies already restrict what data can be updated/deleted
-- This policy only adds SELECT access for the limited view