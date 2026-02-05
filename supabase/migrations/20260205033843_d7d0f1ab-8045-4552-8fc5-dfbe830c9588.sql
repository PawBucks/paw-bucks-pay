-- Add RLS policy to allow public read access to approved merchants
-- This is required for the merchants_public view (with security_invoker=on) to work

CREATE POLICY "Public can view approved merchants"
ON public.merchants
FOR SELECT
TO anon, authenticated
USING (approval_status = 'approved'::approval_status);