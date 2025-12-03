-- Create merchant reviews table
CREATE TABLE public.merchant_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create review photos table
CREATE TABLE public.review_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.merchant_reviews(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;

-- Reviews policies
CREATE POLICY "Everyone can view reviews" ON public.merchant_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews" ON public.merchant_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" ON public.merchant_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" ON public.merchant_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Review photos policies
CREATE POLICY "Everyone can view review photos" ON public.review_photos
  FOR SELECT USING (true);

CREATE POLICY "Users can add photos to their reviews" ON public.review_photos
  FOR INSERT WITH CHECK (
    review_id IN (SELECT id FROM public.merchant_reviews WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete photos from their reviews" ON public.review_photos
  FOR DELETE USING (
    review_id IN (SELECT id FROM public.merchant_reviews WHERE user_id = auth.uid())
  );

-- Create storage bucket for review photos
INSERT INTO storage.buckets (id, name, public) VALUES ('review-photos', 'review-photos', true);

-- Storage policies for review photos
CREATE POLICY "Anyone can view review photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'review-photos');

CREATE POLICY "Authenticated users can upload review photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'review-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own review photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'review-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add index for faster merchant review lookups
CREATE INDEX idx_merchant_reviews_merchant_id ON public.merchant_reviews(merchant_id);
CREATE INDEX idx_review_photos_review_id ON public.review_photos(review_id);

-- Trigger for updated_at
CREATE TRIGGER update_merchant_reviews_updated_at
  BEFORE UPDATE ON public.merchant_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();