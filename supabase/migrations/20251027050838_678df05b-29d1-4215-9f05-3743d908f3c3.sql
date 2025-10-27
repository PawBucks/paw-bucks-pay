-- Create pet_type enum
CREATE TYPE public.pet_type AS ENUM ('dog', 'cat', 'other');

-- Create storage bucket for pet photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pet-photos',
  'pet-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- Create pet_profiles table
CREATE TABLE public.pet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pet_name TEXT NOT NULL,
  pet_type public.pet_type NOT NULL,
  breed TEXT,
  birthday DATE,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pet_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pet_profiles
CREATE POLICY "Users can view their own pet profiles"
  ON public.pet_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pet profiles"
  ON public.pet_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pet profiles"
  ON public.pet_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pet profiles"
  ON public.pet_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Storage policies for pet-photos bucket
CREATE POLICY "Users can view pet photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-photos');

CREATE POLICY "Users can upload their own pet photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pet-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own pet photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pet-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own pet photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pet-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Trigger for updated_at
CREATE TRIGGER update_pet_profiles_updated_at
  BEFORE UPDATE ON public.pet_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();