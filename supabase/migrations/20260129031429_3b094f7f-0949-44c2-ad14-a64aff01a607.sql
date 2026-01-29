-- Fix the overly permissive RLS policy on invoice_slices
-- Drop the permissive policy
DROP POLICY IF EXISTS "Service role can manage slices" ON public.invoice_slices;

-- Create proper policies for vet management
CREATE POLICY "Vets can insert slices for their claims"
ON public.invoice_slices FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.insurance_claims ic
    JOIN public.partner_vets pv ON pv.id = ic.vet_id
    WHERE ic.id = claim_id
    AND pv.user_id = auth.uid()
  )
);

CREATE POLICY "Vets can update slices for their claims"
ON public.invoice_slices FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.insurance_claims ic
    JOIN public.partner_vets pv ON pv.id = ic.vet_id
    WHERE ic.id = invoice_slices.claim_id
    AND pv.user_id = auth.uid()
  )
);

-- Allow owners to view slices related to their invoices
CREATE POLICY "Owners can view slices for their invoices"
ON public.invoice_slices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_slices.invoice_id
    AND inv.client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Allow owners to update their recovery options
CREATE POLICY "Owners can update recovery option"
ON public.invoice_slices FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_slices.invoice_id
    AND inv.client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Add policies for claim_recovery_log inserts
CREATE POLICY "Vets can insert recovery logs"
ON public.claim_recovery_log FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoice_slices isl
    JOIN public.insurance_claims ic ON ic.id = isl.claim_id
    JOIN public.partner_vets pv ON pv.id = ic.vet_id
    WHERE isl.id = slice_id
    AND pv.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert recovery logs"
ON public.claim_recovery_log FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoice_slices isl
    JOIN public.invoices inv ON inv.id = isl.invoice_id
    WHERE isl.id = slice_id
    AND inv.client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Add policies for payment plans
CREATE POLICY "Owners can insert payment plans"
ON public.claim_payment_plans FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their payment plans"
ON public.claim_payment_plans FOR UPDATE
USING (owner_id = auth.uid());