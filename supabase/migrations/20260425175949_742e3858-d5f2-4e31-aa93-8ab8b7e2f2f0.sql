-- Account type change requests table
CREATE TABLE public.merchant_account_type_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  current_fee_model TEXT NOT NULL,
  requested_fee_model TEXT NOT NULL CHECK (requested_fee_model IN ('full_ecosystem','acquisition_only')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','cancelled')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matcr_merchant ON public.merchant_account_type_change_requests(merchant_id);
CREATE INDEX idx_matcr_status ON public.merchant_account_type_change_requests(status);

-- Only one pending request per merchant
CREATE UNIQUE INDEX idx_matcr_one_pending
  ON public.merchant_account_type_change_requests(merchant_id)
  WHERE status = 'pending';

ALTER TABLE public.merchant_account_type_change_requests ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own requests
CREATE POLICY "Merchant views own change requests"
ON public.merchant_account_type_change_requests
FOR SELECT TO authenticated
USING (public.user_owns_merchant(merchant_id));

-- Merchants can insert (must own merchant + match auth.uid)
CREATE POLICY "Merchant creates own change request"
ON public.merchant_account_type_change_requests
FOR INSERT TO authenticated
WITH CHECK (public.user_owns_merchant(merchant_id) AND user_id = auth.uid());

-- Merchants can cancel their own pending request
CREATE POLICY "Merchant cancels own pending request"
ON public.merchant_account_type_change_requests
FOR UPDATE TO authenticated
USING (public.user_owns_merchant(merchant_id) AND status = 'pending')
WITH CHECK (public.user_owns_merchant(merchant_id) AND status IN ('pending','cancelled'));

-- Admins/superadmins can view all and update
CREATE POLICY "Admins view all change requests"
ON public.merchant_account_type_change_requests
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);

CREATE POLICY "Admins update change requests"
ON public.merchant_account_type_change_requests
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);

CREATE TRIGGER update_matcr_updated_at
BEFORE UPDATE ON public.merchant_account_type_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: notify merchant when fee_model changes
CREATE OR REPLACE FUNCTION public.notify_merchant_fee_model_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_label TEXT;
  v_new_label TEXT;
BEGIN
  IF NEW.fee_model IS DISTINCT FROM OLD.fee_model AND NEW.user_id IS NOT NULL THEN
    v_old_label := CASE WHEN OLD.fee_model = 'acquisition_only' THEN 'Acquisition-Only' ELSE 'Full Ecosystem' END;
    v_new_label := CASE WHEN NEW.fee_model = 'acquisition_only' THEN 'Acquisition-Only' ELSE 'Full Ecosystem' END;

    INSERT INTO public.notifications (user_id, title, message, category, link_url)
    VALUES (
      NEW.user_id,
      '🔄 Account Type Updated',
      'Your merchant account type has changed from ' || v_old_label || ' to ' || v_new_label || '.',
      'transactional',
      '/merchant'
    );

    -- Auto-resolve any pending request that matches the new model
    UPDATE public.merchant_account_type_change_requests
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now()),
        updated_at = now()
    WHERE merchant_id = NEW.id
      AND status = 'pending'
      AND requested_fee_model = NEW.fee_model;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_merchant_fee_model_change
AFTER UPDATE OF fee_model ON public.merchants
FOR EACH ROW EXECUTE FUNCTION public.notify_merchant_fee_model_change();