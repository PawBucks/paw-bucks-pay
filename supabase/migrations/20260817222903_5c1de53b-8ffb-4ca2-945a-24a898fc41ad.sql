-- accountant_invitations
DROP POLICY IF EXISTS "Authenticated users can view their invitations" ON public.accountant_invitations;
CREATE POLICY "Authenticated users can view their invitations"
ON public.accountant_invitations FOR SELECT TO authenticated
USING (
  ((accountant_email = public.get_current_user_email()) AND public.current_user_email_confirmed())
  OR (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id = auth.uid()))
);

-- accountant_activity_log
DROP POLICY IF EXISTS "Accountants can log their own activity" ON public.accountant_activity_log;
CREATE POLICY "Accountants can log their own activity"
ON public.accountant_activity_log FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_email_confirmed()
  AND invitation_id IN (
    SELECT ai.id FROM public.accountant_invitations ai
    WHERE ai.accountant_email = public.get_current_user_email()
      AND ai.status = 'accepted' AND ai.expires_at > now()
  )
);

DROP POLICY IF EXISTS "Accountants can view their activity logs" ON public.accountant_activity_log;
CREATE POLICY "Accountants can view their activity logs"
ON public.accountant_activity_log FOR SELECT TO authenticated
USING (
  (public.current_user_email_confirmed() AND invitation_id IN (
    SELECT ai.id FROM public.accountant_invitations ai
    WHERE ai.accountant_email = public.get_current_user_email() AND ai.status = 'accepted'
  ))
  OR (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id = auth.uid()))
);

-- accountant_expense_notes
DROP POLICY IF EXISTS "Accountants can add notes to assigned expenses" ON public.accountant_expense_notes;
CREATE POLICY "Accountants can add notes to assigned expenses"
ON public.accountant_expense_notes FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_email_confirmed()
  AND invitation_id IN (
    SELECT ai.id FROM public.accountant_invitations ai
    WHERE ai.accountant_email = public.get_current_user_email()
      AND ai.status = 'accepted' AND ai.expires_at > now()
  )
);

DROP POLICY IF EXISTS "Accountants can update their own notes" ON public.accountant_expense_notes;
CREATE POLICY "Accountants can update their own notes"
ON public.accountant_expense_notes FOR UPDATE TO authenticated
USING (
  public.current_user_email_confirmed()
  AND invitation_id IN (
    SELECT ai.id FROM public.accountant_invitations ai
    WHERE ai.accountant_email = public.get_current_user_email() AND ai.status = 'accepted'
  )
)
WITH CHECK (
  public.current_user_email_confirmed()
  AND invitation_id IN (
    SELECT ai.id FROM public.accountant_invitations ai
    WHERE ai.accountant_email = public.get_current_user_email() AND ai.status = 'accepted'
  )
);

DROP POLICY IF EXISTS "Accountants can view notes on their assigned expenses" ON public.accountant_expense_notes;
CREATE POLICY "Accountants can view notes on their assigned expenses"
ON public.accountant_expense_notes FOR SELECT TO authenticated
USING (
  (public.current_user_email_confirmed() AND invitation_id IN (
    SELECT ai.id FROM public.accountant_invitations ai
    WHERE ai.accountant_email = public.get_current_user_email() AND ai.status = 'accepted'
  ))
  OR invitation_id IN (
    SELECT ai.id FROM public.accountant_invitations ai
    WHERE ai.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id = auth.uid())
  )
);

-- merchant_mileage_log
DROP POLICY IF EXISTS "Accountants can view mileage via valid invitation" ON public.merchant_mileage_log;
CREATE POLICY "Accountants can view mileage via valid invitation"
ON public.merchant_mileage_log FOR SELECT TO authenticated
USING (
  public.current_user_email_confirmed()
  AND merchant_id IN (
    SELECT ai.merchant_id FROM public.accountant_invitations ai
    WHERE ai.status = 'accepted' AND ai.expires_at > now()
      AND ai.accountant_email = public.get_current_user_email()
  )
);

-- merchant_tax_expenses
DROP POLICY IF EXISTS "Accountants can view expenses via valid invitation" ON public.merchant_tax_expenses;
CREATE POLICY "Accountants can view expenses via valid invitation"
ON public.merchant_tax_expenses FOR SELECT TO authenticated
USING (
  public.current_user_email_confirmed()
  AND merchant_id IN (
    SELECT ai.merchant_id FROM public.accountant_invitations ai
    WHERE ai.status = 'accepted' AND ai.expires_at > now()
      AND ai.accountant_email = public.get_current_user_email()
  )
);

-- merchant_vehicle_expenses
DROP POLICY IF EXISTS "Accountants can view vehicle expenses via valid invitation" ON public.merchant_vehicle_expenses;
CREATE POLICY "Accountants can view vehicle expenses via valid invitation"
ON public.merchant_vehicle_expenses FOR SELECT TO authenticated
USING (
  public.current_user_email_confirmed()
  AND merchant_id IN (
    SELECT ai.merchant_id FROM public.accountant_invitations ai
    WHERE ai.status = 'accepted' AND ai.expires_at > now()
      AND ai.accountant_email = public.get_current_user_email()
  )
);

-- invoice_slices
DROP POLICY IF EXISTS "Owners can view slices for their invoices" ON public.invoice_slices;
CREATE POLICY "Owners can view slices for their invoices"
ON public.invoice_slices FOR SELECT TO authenticated
USING (
  public.current_user_email_confirmed()
  AND EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_slices.invoice_id
      AND inv.client_email = public.get_current_user_email()
  )
);

DROP POLICY IF EXISTS "Owners can update recovery option" ON public.invoice_slices;
CREATE POLICY "Owners can update recovery option"
ON public.invoice_slices FOR UPDATE TO authenticated
USING (
  public.current_user_email_confirmed()
  AND EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_slices.invoice_id
      AND inv.client_email = public.get_current_user_email()
  )
)
WITH CHECK (
  public.current_user_email_confirmed()
  AND EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = invoice_slices.invoice_id
      AND inv.client_email = public.get_current_user_email()
  )
);

-- claim_recovery_log
DROP POLICY IF EXISTS "Owners can insert recovery logs" ON public.claim_recovery_log;
CREATE POLICY "Owners can insert recovery logs"
ON public.claim_recovery_log FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_email_confirmed()
  AND EXISTS (
    SELECT 1 FROM public.invoice_slices isl
    JOIN public.invoices inv ON inv.id = isl.invoice_id
    WHERE isl.id = claim_recovery_log.slice_id
      AND inv.client_email = public.get_current_user_email()
  )
);