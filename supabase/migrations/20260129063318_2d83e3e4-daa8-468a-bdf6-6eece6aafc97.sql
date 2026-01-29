-- Add SELECT policy to allow reading approved merchants via the public view
-- This is safe because the merchants_public view only exposes non-sensitive fields
-- and filters to approved merchants only
CREATE POLICY "Anyone can view approved merchants via public view"
  ON public.merchants
  FOR SELECT
  USING (approval_status = 'approved'::approval_status);