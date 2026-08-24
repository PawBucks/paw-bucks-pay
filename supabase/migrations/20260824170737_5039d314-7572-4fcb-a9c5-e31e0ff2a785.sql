CREATE TABLE public.petfest_vendor_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  website TEXT,
  business_category TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('tier_1','tier_2','tier_3')),
  booth_count INTEGER NOT NULL DEFAULT 1 CHECK (booth_count BETWEEN 1 AND 5),
  power_needed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','waitlisted','rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.petfest_vendor_applications TO authenticated;
GRANT ALL ON public.petfest_vendor_applications TO service_role;

ALTER TABLE public.petfest_vendor_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own applications"
  ON public.petfest_vendor_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Merchants and vets can apply"
  ON public.petfest_vendor_applications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND admin_notes IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.merchants m WHERE m.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.partner_vets v WHERE v.user_id = auth.uid())
    )
  );

CREATE POLICY "Admins manage vendor applications"
  ON public.petfest_vendor_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER update_petfest_vendor_applications_updated_at
  BEFORE UPDATE ON public.petfest_vendor_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();