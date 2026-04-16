
ALTER TABLE public.pet_store_items ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- Migrate existing image_url data into image_urls array
UPDATE public.pet_store_items 
SET image_urls = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND image_url != '' AND (image_urls IS NULL OR image_urls = '{}');
