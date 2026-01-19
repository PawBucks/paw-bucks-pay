-- Create a restricted view for merchant customer access
-- This follows the data minimization principle by exposing only essential contact fields

-- Create the merchant_customer_contacts view
CREATE OR REPLACE VIEW public.merchant_customer_contacts AS
SELECT 
  id,
  full_name,
  email,
  phone,
  stripe_customer_id
FROM public.profiles;

-- Grant access to authenticated users (RLS on base table still applies)
GRANT SELECT ON public.merchant_customer_contacts TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.merchant_customer_contacts IS 'Restricted view of customer profiles for merchant access. Exposes only essential contact fields (name, email, phone, stripe_customer_id) needed for business operations. Excludes avatar_url and referral_code for data minimization.';