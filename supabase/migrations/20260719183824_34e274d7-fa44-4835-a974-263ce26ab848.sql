-- Restore invoices grants: full CRUD for authenticated on all columns EXCEPT access_token (SELECT).
-- access_token stays hidden from client SELECTs but writable for creation.
GRANT INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT (
  id, merchant_id, client_id, invoice_number, status, issue_date, due_date,
  sent_at, viewed_at, paid_at, client_name, client_email, client_phone,
  client_company, client_address, subtotal, discount_type, discount_value,
  discount_amount, tax_rate, tax_amount, shipping_amount, total, amount_paid,
  amount_due, currency, title, notes, footer, terms_conditions, payment_terms,
  allow_partial_payments, allow_tips, accept_credit_card, accept_bank_transfer,
  accept_pawbucks, view_count, stripe_payment_intent_id, stripe_invoice_id,
  is_recurring, recurring_interval, recurring_end_date, parent_invoice_id,
  next_invoice_date, attachment_urls, created_at, updated_at
) ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;