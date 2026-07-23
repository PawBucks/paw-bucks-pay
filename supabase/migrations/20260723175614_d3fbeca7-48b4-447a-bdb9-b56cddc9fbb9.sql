
-- invoice_slices: restrict updates to recovery_option/option_selected_at only
DROP POLICY IF EXISTS "Owners can update recovery option" ON public.invoice_slices;

CREATE OR REPLACE FUNCTION public.enforce_invoice_slice_owner_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when the actor is the invoice client (not merchant/service role).
  IF EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = NEW.invoice_id
      AND inv.client_email = public.get_current_user_email()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = NEW.invoice_id
      AND inv.merchant_id = auth.uid()
  ) THEN
    IF NEW.invoice_id       IS DISTINCT FROM OLD.invoice_id       OR
       NEW.slice_type        IS DISTINCT FROM OLD.slice_type       OR
       NEW.original_amount   IS DISTINCT FROM OLD.original_amount  OR
       NEW.actual_amount     IS DISTINCT FROM OLD.actual_amount    OR
       NEW.gap_amount        IS DISTINCT FROM OLD.gap_amount       OR
       NEW.recovery_status   IS DISTINCT FROM OLD.recovery_status  OR
       NEW.insurance_claim_id IS DISTINCT FROM OLD.insurance_claim_id OR
       NEW.payment_plan_id   IS DISTINCT FROM OLD.payment_plan_id  OR
       NEW.metadata          IS DISTINCT FROM OLD.metadata         OR
       NEW.created_at        IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Invoice clients can only update recovery_option and option_selected_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_slice_owner_update ON public.invoice_slices;
CREATE TRIGGER trg_enforce_invoice_slice_owner_update
BEFORE UPDATE ON public.invoice_slices
FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_slice_owner_update();

CREATE POLICY "Owners can update recovery option"
ON public.invoice_slices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_slices.invoice_id
      AND inv.client_email = public.get_current_user_email()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_slices.invoice_id
      AND inv.client_email = public.get_current_user_email()
  )
);

-- pet_consent_requests: restrict pet-owner sign updates to signature fields only
DROP POLICY IF EXISTS "Pet owners can update consent requests (sign)" ON public.pet_consent_requests;

CREATE OR REPLACE FUNCTION public.enforce_pet_consent_owner_sign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when the actor is the pet owner (not the requesting vet or service role).
  IF NEW.owner_id = auth.uid()
     AND (NEW.vet_partner_id IS NULL OR NEW.vet_partner_id <> auth.uid()) THEN
    IF NEW.pet_id            IS DISTINCT FROM OLD.pet_id            OR
       NEW.owner_id          IS DISTINCT FROM OLD.owner_id          OR
       NEW.vet_partner_id    IS DISTINCT FROM OLD.vet_partner_id    OR
       NEW.consent_type      IS DISTINCT FROM OLD.consent_type      OR
       NEW.procedure_name    IS DISTINCT FROM OLD.procedure_name    OR
       NEW.procedure_details IS DISTINCT FROM OLD.procedure_details OR
       NEW.risks_disclosed   IS DISTINCT FROM OLD.risks_disclosed   OR
       NEW.alternatives_disclosed IS DISTINCT FROM OLD.alternatives_disclosed OR
       NEW.estimated_cost    IS DISTINCT FROM OLD.estimated_cost    OR
       NEW.access_token      IS DISTINCT FROM OLD.access_token      OR
       NEW.expires_at        IS DISTINCT FROM OLD.expires_at        OR
       NEW.created_at        IS DISTINCT FROM OLD.created_at        OR
       NEW.created_by        IS DISTINCT FROM OLD.created_by
    THEN
      RAISE EXCEPTION 'Pet owners may only sign consent requests, not modify vet-authored fields';
    END IF;

    IF NEW.status NOT IN ('signed', 'declined', 'pending') THEN
      RAISE EXCEPTION 'Invalid status transition for owner-signed consent';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pet_consent_owner_sign ON public.pet_consent_requests;
CREATE TRIGGER trg_enforce_pet_consent_owner_sign
BEFORE UPDATE ON public.pet_consent_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_pet_consent_owner_sign();

CREATE POLICY "Pet owners can update consent requests (sign)"
ON public.pet_consent_requests
FOR UPDATE
USING (owner_id = auth.uid() AND status = 'pending'::consent_status)
WITH CHECK (owner_id = auth.uid() AND status IN ('signed'::consent_status, 'declined'::consent_status, 'pending'::consent_status));
