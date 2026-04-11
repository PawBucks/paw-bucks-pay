-- Add reminder tracking columns to service_bookings
ALTER TABLE public.service_bookings 
ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN NOT NULL DEFAULT false;

-- Create grooming report cards table
CREATE TABLE public.grooming_report_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.service_bookings(id) ON DELETE SET NULL,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE SET NULL,
  customer_user_id UUID NOT NULL,
  pet_name TEXT,
  overall_notes TEXT,
  behavior_notes TEXT,
  skin_coat_notes TEXT,
  recommendations TEXT,
  services_performed TEXT[],
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grooming_report_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage their own report cards"
ON public.grooming_report_cards
FOR ALL
TO authenticated
USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()))
WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Customers can view sent report cards"
ON public.grooming_report_cards
FOR SELECT
TO authenticated
USING (customer_user_id = auth.uid() AND status = 'sent');

-- Create grooming report photos table
CREATE TABLE public.grooming_report_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.grooming_report_cards(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grooming_report_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage photos for their reports"
ON public.grooming_report_photos
FOR ALL
TO authenticated
USING (report_id IN (
  SELECT id FROM public.grooming_report_cards 
  WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
))
WITH CHECK (report_id IN (
  SELECT id FROM public.grooming_report_cards 
  WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
));

CREATE POLICY "Customers can view photos for their sent reports"
ON public.grooming_report_photos
FOR SELECT
TO authenticated
USING (report_id IN (
  SELECT id FROM public.grooming_report_cards 
  WHERE customer_user_id = auth.uid() AND status = 'sent'
));

-- Create storage bucket for grooming report photos
INSERT INTO storage.buckets (id, name, public) VALUES ('grooming-reports', 'grooming-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Merchants can upload grooming photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'grooming-reports' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM public.merchants WHERE user_id = auth.uid()
));

CREATE POLICY "Merchants can view their grooming photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'grooming-reports' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM public.merchants WHERE user_id = auth.uid()
));

CREATE POLICY "Customers can view grooming photos for their reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'grooming-reports' AND name IN (
  SELECT gp.photo_url FROM public.grooming_report_photos gp
  JOIN public.grooming_report_cards gc ON gc.id = gp.report_id
  WHERE gc.customer_user_id = auth.uid() AND gc.status = 'sent'
));

-- Updated_at trigger for report cards
CREATE TRIGGER update_grooming_report_cards_updated_at
BEFORE UPDATE ON public.grooming_report_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();