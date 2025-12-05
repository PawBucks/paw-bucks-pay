-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Everyone can view merchants" ON public.merchants;

-- Create a public view with only non-sensitive business fields
CREATE OR REPLACE VIEW public.merchants_public AS
SELECT 
  id,
  business_name,
  business_type,
  description,
  logo_url,
  address,
  latitude,
  longitude,
  cashback_rate,
  accepts_pawbucks,
  price_range,
  is_sponsored,
  sponsored_until,
  created_at
FROM public.merchants;

-- Grant public access to the view
GRANT SELECT ON public.merchants_public TO anon, authenticated;

-- Create a more restrictive policy for the base table
-- Only merchants can see their own full record (including contact info)
CREATE POLICY "Merchants can view their own full record"
ON public.merchants
FOR SELECT
USING (auth.uid() = user_id);

-- Note: "Admins can view all merchants" policy already exists with proper role check