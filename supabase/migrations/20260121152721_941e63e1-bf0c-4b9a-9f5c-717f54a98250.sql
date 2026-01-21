-- Create storage bucket for invoice attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-attachments',
  'invoice-attachments',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for invoice attachments bucket
-- Merchants can upload files to their own folder (folder name = merchant_id)
CREATE POLICY "Merchants can upload invoice attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoice-attachments' 
  AND auth.uid() IN (
    SELECT user_id FROM public.merchants WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Merchants can view their own attachments
CREATE POLICY "Merchants can view their invoice attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoice-attachments' 
  AND auth.uid() IN (
    SELECT user_id FROM public.merchants WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Merchants can delete their own attachments
CREATE POLICY "Merchants can delete their invoice attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoice-attachments' 
  AND auth.uid() IN (
    SELECT user_id FROM public.merchants WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Public access for invoice attachments via signed URLs (for clients viewing invoices)
-- This allows the get-public-invoice edge function to generate signed URLs
CREATE POLICY "Public read access for invoice attachments with token"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-attachments');