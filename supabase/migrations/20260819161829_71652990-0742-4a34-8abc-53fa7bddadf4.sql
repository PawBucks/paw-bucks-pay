CREATE TABLE public.merchant_booking_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('calendly','cal_com','acuity','petdesk','other')),
  booking_url text NOT NULL CHECK (booking_url ~* '^https://'),
  display_label text,
  is_enabled boolean NOT NULL DEFAULT true,
  replace_in_app_booking boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_booking_integrations TO authenticated;
GRANT SELECT ON public.merchant_booking_integrations TO anon;
GRANT ALL ON public.merchant_booking_integrations TO service_role;

ALTER TABLE public.merchant_booking_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage their own booking integration"
ON public.merchant_booking_integrations
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));

CREATE POLICY "Anyone can view enabled booking integrations"
ON public.merchant_booking_integrations
FOR SELECT
TO anon, authenticated
USING (is_enabled = true);

CREATE POLICY "Admins can view all booking integrations"
ON public.merchant_booking_integrations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_merchant_booking_integrations_updated_at
BEFORE UPDATE ON public.merchant_booking_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();