-- Add missing pet profiles index with correct column name
CREATE INDEX IF NOT EXISTS idx_pet_profiles_user 
ON public.pet_profiles (user_id);

-- Add notifications index with correct column names
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications (user_id, is_read, created_at DESC) 
WHERE is_read = false;