-- Create assets storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to assets
CREATE POLICY "Public can view assets" ON storage.objects
FOR SELECT USING (bucket_id = 'assets');

-- Allow authenticated users to upload assets (for admin uploads)
CREATE POLICY "Authenticated users can upload assets" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');