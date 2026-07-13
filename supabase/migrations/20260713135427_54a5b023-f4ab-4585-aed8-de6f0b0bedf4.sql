-- Restrict server-only token/secret columns from direct client reads.
-- RLS still controls which rows are visible; these grants control which columns
-- authenticated/API clients may receive from those visible rows.

-- admin_invoices.access_token must remain service-only.
REVOKE SELECT ON public.admin_invoices FROM anon, authenticated;
GRANT SELECT (
  id,
  invoice_number,
  recipient_type,
  recipient_id,
  recipient_name,
  recipient_email,
  title,
  description,
  status,
  subtotal,
  tax_rate,
  tax_amount,
  discount_amount,
  total,
  amount_paid,
  amount_due,
  currency,
  issue_date,
  due_date,
  paid_at,
  notes,
  terms_conditions,
  invoice_type,
  created_by,
  created_at,
  updated_at
) ON public.admin_invoices TO authenticated;
GRANT SELECT ON public.admin_invoices TO service_role;

-- merchant_webhooks.secret must remain service-only.
REVOKE SELECT ON public.merchant_webhooks FROM anon, authenticated;
GRANT SELECT (
  id,
  merchant_id,
  name,
  url,
  events,
  is_active,
  last_triggered_at,
  failure_count,
  created_at,
  updated_at
) ON public.merchant_webhooks TO authenticated;
GRANT SELECT ON public.merchant_webhooks TO service_role;

-- pet_consent_requests.access_token must remain service-only.
REVOKE SELECT ON public.pet_consent_requests FROM anon, authenticated;
GRANT SELECT (
  id,
  pet_id,
  vet_id,
  template_id,
  owner_id,
  consent_type,
  title,
  description,
  procedure_details,
  risks_disclosed,
  estimated_cost,
  cost_range_min,
  cost_range_max,
  status,
  signature_data,
  signed_name,
  signed_at,
  signer_ip_address,
  signer_user_agent,
  expires_at,
  sent_via,
  reminder_sent_at,
  created_at,
  updated_at
) ON public.pet_consent_requests TO authenticated;
GRANT SELECT ON public.pet_consent_requests TO service_role;