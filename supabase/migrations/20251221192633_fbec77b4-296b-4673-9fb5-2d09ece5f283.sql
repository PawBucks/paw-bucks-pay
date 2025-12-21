-- Add photo_urls column for multiple photos (up to 5)
ALTER TABLE public.lost_pet_posts 
ADD COLUMN photo_urls text[] DEFAULT '{}'::text[];

-- Migrate existing single photo_url to photo_urls array
UPDATE public.lost_pet_posts 
SET photo_urls = ARRAY[photo_url]
WHERE photo_url IS NOT NULL AND photo_url != '';

-- Add a comment explaining the column
COMMENT ON COLUMN public.lost_pet_posts.photo_urls IS 'Array of photo URLs, up to 5 photos allowed';