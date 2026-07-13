
-- Hide sensitive token/secret columns from PostgREST client reads by removing
-- table-wide SELECT for anon/authenticated and re-granting SELECT on every
-- non-sensitive column. Service role bypasses column privileges and continues
-- to have full access.

-- accountant_invitations: hide access_token
REVOKE SELECT ON public.accountant_invitations FROM anon, authenticated;
GRANT SELECT (
  id, merchant_id, accountant_email, accountant_name,
  permissions, status, invited_at, accepted_at, expires_at,
  last_accessed_at, created_at, updated_at
) ON public.accountant_invitations TO authenticated;

-- admin_invoices: hide access_token
REVOKE SELECT ON public.admin_invoices FROM anon, authenticated;
GRANT SELECT (
  id, invoice_number, recipient_type, recipient_id, recipient_name, recipient_email,
  title, description, status, subtotal, tax_rate, tax_amount, discount_amount,
  total, amount_paid, amount_due, currency, issue_date, due_date, paid_at,
  notes, terms_conditions, invoice_type, created_by, created_at, updated_at
) ON public.admin_invoices TO authenticated;

-- merchant_webhooks: hide secret
REVOKE SELECT ON public.merchant_webhooks FROM anon, authenticated;
GRANT SELECT (
  id, merchant_id, name, url, events, is_active,
  last_triggered_at, failure_count, created_at, updated_at
) ON public.merchant_webhooks TO authenticated;

-- pet_consent_requests: hide access_token
REVOKE SELECT ON public.pet_consent_requests FROM anon, authenticated;
GRANT SELECT (
  id, pet_id, vet_id, template_id, owner_id, consent_type, title, description,
  procedure_details, risks_disclosed, estimated_cost, cost_range_min, cost_range_max,
  status, signature_data, signed_name, signed_at, signer_ip_address, signer_user_agent,
  expires_at, sent_via, reminder_sent_at, created_at, updated_at
) ON public.pet_consent_requests TO authenticated;
