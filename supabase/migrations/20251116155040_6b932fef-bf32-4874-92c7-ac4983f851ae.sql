-- Add logo_url column to merchants table
ALTER TABLE public.merchants
ADD COLUMN logo_url TEXT;

-- Create merchant-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-logos', 'merchant-logos', true);

-- RLS policies for merchant-logos bucket
CREATE POLICY "Merchants can upload their own logo"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'merchant-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Merchants can update their own logo"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'merchant-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Merchants can delete their own logo"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'merchant-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view merchant logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'merchant-logos');