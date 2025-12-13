-- Add category column to notifications table
ALTER TABLE public.notifications 
ADD COLUMN category text NOT NULL DEFAULT 'general';

-- Create index for faster filtering
CREATE INDEX idx_notifications_category ON public.notifications(category);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);