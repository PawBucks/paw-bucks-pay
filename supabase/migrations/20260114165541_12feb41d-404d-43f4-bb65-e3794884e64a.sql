-- Add social media columns to merchants table
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS linkedin_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.merchants.facebook_url IS 'Facebook page URL';
COMMENT ON COLUMN public.merchants.instagram_url IS 'Instagram profile URL';
COMMENT ON COLUMN public.merchants.twitter_url IS 'Twitter/X profile URL';
COMMENT ON COLUMN public.merchants.linkedin_url IS 'LinkedIn page URL';