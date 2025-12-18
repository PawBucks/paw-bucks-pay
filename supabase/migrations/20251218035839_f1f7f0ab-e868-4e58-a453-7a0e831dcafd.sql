-- Add storefront_slug column to merchants table
ALTER TABLE public.merchants
ADD COLUMN storefront_slug text UNIQUE;

-- Create a function to generate a URL-safe slug from business name
CREATE OR REPLACE FUNCTION public.generate_storefront_slug(business_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  slug_exists boolean;
  counter integer := 1;
BEGIN
  -- Convert to lowercase, replace spaces and special chars with nothing, keep only alphanumeric
  base_slug := lower(regexp_replace(business_name, '[^a-zA-Z0-9]', '', 'g'));
  
  -- If empty, generate random slug
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'store' || substr(md5(random()::text), 1, 8);
  END IF;
  
  final_slug := base_slug;
  
  -- Check if slug exists and add counter if needed
  LOOP
    SELECT EXISTS(SELECT 1 FROM merchants WHERE storefront_slug = final_slug) INTO slug_exists;
    EXIT WHEN NOT slug_exists;
    counter := counter + 1;
    final_slug := base_slug || counter::text;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Update existing merchants with generated slugs based on business_name
UPDATE public.merchants
SET storefront_slug = generate_storefront_slug(business_name)
WHERE storefront_slug IS NULL;

-- Make storefront_slug NOT NULL after populating existing records
ALTER TABLE public.merchants
ALTER COLUMN storefront_slug SET NOT NULL;

-- Create index for fast slug lookups
CREATE INDEX idx_merchants_storefront_slug ON public.merchants(storefront_slug);

-- Update the merchants_public view to include storefront_slug
DROP VIEW IF EXISTS public.merchants_public;
CREATE VIEW public.merchants_public AS
SELECT 
  id,
  business_name,
  business_type,
  description,
  logo_url,
  address,
  phone,
  latitude,
  longitude,
  cashback_rate,
  accepts_pawbucks,
  price_range,
  is_sponsored,
  sponsored_until,
  created_at,
  storefront_slug
FROM public.merchants;

-- Grant access to the view
GRANT SELECT ON public.merchants_public TO anon, authenticated;