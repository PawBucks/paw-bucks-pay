-- Create lost_pet_posts table for digital flyers
CREATE TABLE public.lost_pet_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Pet Information
  pet_name TEXT NOT NULL,
  pet_type TEXT NOT NULL, -- dog, cat, bird, etc.
  breed TEXT,
  color_markings TEXT NOT NULL,
  size TEXT, -- small, medium, large
  age_estimate TEXT,
  gender TEXT,
  
  -- Identification
  microchip_number TEXT,
  collar_description TEXT,
  identifying_features TEXT,
  
  -- Photo
  photo_url TEXT,
  
  -- Last Seen Information
  last_seen_location TEXT NOT NULL,
  last_seen_date DATE NOT NULL,
  last_seen_time TEXT,
  last_seen_area_description TEXT,
  
  -- Contact Information
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  
  -- Additional
  reward_amount NUMERIC,
  additional_notes TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'lost', -- lost, found, reunited
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lost_pet_posts ENABLE ROW LEVEL SECURITY;

-- Public can view all active posts (including anonymous)
CREATE POLICY "Anyone can view active lost pet posts"
ON public.lost_pet_posts
FOR SELECT
USING (is_active = true);

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create lost pet posts"
ON public.lost_pet_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own lost pet posts"
ON public.lost_pet_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete their own lost pet posts"
ON public.lost_pet_posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can manage all posts
CREATE POLICY "Admins can manage all lost pet posts"
ON public.lost_pet_posts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_lost_pet_posts_updated_at
BEFORE UPDATE ON public.lost_pet_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for lost pet photos (public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lost-pet-photos', 'lost-pet-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for lost pet photos
CREATE POLICY "Anyone can view lost pet photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'lost-pet-photos');

CREATE POLICY "Authenticated users can upload lost pet photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lost-pet-photos');

CREATE POLICY "Users can update their own lost pet photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lost-pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own lost pet photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'lost-pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);