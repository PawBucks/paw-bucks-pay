-- Add approval_status enum
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'denied');

-- Add approval_status to merchants table
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS approval_status approval_status NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS denial_reason TEXT;

-- Add approval_status to partner_vets table
ALTER TABLE public.partner_vets
ADD COLUMN IF NOT EXISTS approval_status approval_status NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS denial_reason TEXT;

-- Update existing records to approved (for backward compatibility)
UPDATE public.merchants SET approval_status = 'approved' WHERE approval_status = 'pending';
UPDATE public.partner_vets SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Create index for faster pending queries
CREATE INDEX IF NOT EXISTS idx_merchants_approval_status ON public.merchants(approval_status);
CREATE INDEX IF NOT EXISTS idx_partner_vets_approval_status ON public.partner_vets(approval_status);

-- Update merchants_public view to include approval_status (only show approved merchants)
DROP VIEW IF EXISTS public.merchants_public;
CREATE VIEW public.merchants_public WITH (security_invoker=on) AS
SELECT 
  id,
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
  linkedin_url
FROM public.merchants
WHERE approval_status = 'approved';

-- Create partner_vets_public view (only show approved vets)
DROP VIEW IF EXISTS public.partner_vets_public;
CREATE VIEW public.partner_vets_public WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  clinic_name,
  location,
  website_url,
  practice_type,
  accreditations,
  insurance_partners,
  direct_pay_enabled,
  accepting_new_patients,
  emergency_protocol
FROM public.partner_vets
WHERE approval_status = 'approved';

-- RLS policies for approval management (admin only)
CREATE POLICY "Admins can update merchant approval" ON public.merchants
FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can update vet approval" ON public.partner_vets
FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));