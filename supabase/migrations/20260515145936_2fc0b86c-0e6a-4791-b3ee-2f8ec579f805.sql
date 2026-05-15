
CREATE TABLE public.merchant_funding_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  business_name text NOT NULL,
  contact_name text,
  contact_email text NOT NULL,
  contact_phone text,
  monthly_revenue_range text NOT NULL,
  requested_amount_usd numeric(12,2) NOT NULL,
  use_of_funds text NOT NULL,
  use_of_funds_details text,
  time_in_business text NOT NULL,
  urgency text NOT NULL DEFAULT 'flexible',
  additional_notes text,
  status text NOT NULL DEFAULT 'waitlisted',
  position integer,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id)
);

CREATE INDEX idx_mfw_merchant ON public.merchant_funding_waitlist(merchant_id);
CREATE INDEX idx_mfw_status ON public.merchant_funding_waitlist(status);
CREATE INDEX idx_mfw_created ON public.merchant_funding_waitlist(created_at DESC);

ALTER TABLE public.merchant_funding_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own funding waitlist entry"
ON public.merchant_funding_waitlist FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'superadmin')
);

CREATE POLICY "Merchants join funding waitlist"
ON public.merchant_funding_waitlist FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
);

CREATE POLICY "Merchants update own funding waitlist entry"
ON public.merchant_funding_waitlist FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'superadmin')
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'superadmin')
);

CREATE POLICY "Admins delete funding waitlist entries"
ON public.merchant_funding_waitlist FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'superadmin')
);

CREATE TRIGGER trg_mfw_updated_at
BEFORE UPDATE ON public.merchant_funding_waitlist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
