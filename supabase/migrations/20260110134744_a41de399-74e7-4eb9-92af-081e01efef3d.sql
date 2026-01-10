-- Add column to track if deletion warning was sent
ALTER TABLE public.lost_pet_posts 
ADD COLUMN IF NOT EXISTS deletion_warning_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;