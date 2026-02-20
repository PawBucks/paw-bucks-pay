-- Allow any authenticated user to read approved merchants from base table
-- This is needed because many components use PostgREST relational joins (e.g., merchants(business_name))
-- which require direct table access. The merchants_public view already exposes approved merchants publicly.
-- Sensitive operations (stripe_account_id usage) are handled server-side in edge functions.
CREATE POLICY "Approved merchants are viewable by authenticated users"
  ON public.merchants
  FOR SELECT
  TO authenticated
  USING (approval_status = 'approved');
