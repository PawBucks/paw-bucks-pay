
-- Add policy document URL columns to merchants table
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS tos_url TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS shipping_returns_policy_url TEXT;

-- Add policy document URL columns to partner_vets table
ALTER TABLE public.partner_vets ADD COLUMN IF NOT EXISTS tos_url TEXT;
ALTER TABLE public.partner_vets ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT;
ALTER TABLE public.partner_vets ADD COLUMN IF NOT EXISTS shipping_returns_policy_url TEXT;

-- Create storage bucket for policy documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('policy-documents', 'policy-documents', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Merchants can upload their own policy docs
CREATE POLICY "Merchants can upload policy documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'policy-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Merchants can update their policy documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'policy-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Merchants can delete their policy documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'policy-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view policy documents"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'policy-documents');

-- Update merchants_public view to include policy URLs
DROP VIEW IF EXISTS public.merchants_public;
CREATE VIEW public.merchants_public AS
  SELECT id,
    business_name,
    business_type,
    description,
    logo_url,
    address,
    phone,
    cashback_rate,
    accepts_pawbucks,
    storefront_slug,
    price_range,
    is_sponsored,
    sponsored_until,
    latitude,
    longitude,
    facebook_url,
    instagram_url,
    twitter_url,
    linkedin_url,
    website_url,
    tos_url,
    privacy_policy_url,
    shipping_returns_policy_url
  FROM merchants
  WHERE approval_status = 'approved';

GRANT SELECT ON public.merchants_public TO anon, authenticated;

-- Update partner_vets_public view to include policy URLs
DROP VIEW IF EXISTS public.partner_vets_public;
CREATE VIEW public.partner_vets_public AS
  SELECT id,
    name,
    clinic_name,
    location,
    website_url,
    practice_type,
    accreditations,
    insurance_partners,
    direct_pay_enabled,
    accepting_new_patients,
    emergency_protocol,
    tos_url,
    privacy_policy_url,
    shipping_returns_policy_url
  FROM partner_vets
  WHERE approval_status = 'approved';

GRANT SELECT ON public.partner_vets_public TO anon, authenticated;
