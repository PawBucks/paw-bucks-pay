
-- 1) Revoke column-level SELECT on sensitive bearer tokens / secrets so
--    authenticated/anon clients cannot read them via PostgREST, even though
--    their existing row-level policies still allow reading the rest of the row.
--    service_role retains full access via table-level GRANT ALL.

REVOKE SELECT (access_token) ON public.accountant_invitations FROM PUBLIC, anon, authenticated;
REVOKE SELECT (access_token) ON public.admin_invoices          FROM PUBLIC, anon, authenticated;
REVOKE SELECT (access_token) ON public.pet_consent_requests    FROM PUBLIC, anon, authenticated;
REVOKE SELECT (secret)       ON public.merchant_webhooks       FROM PUBLIC, anon, authenticated;

-- 2) Remove the duplicate permissive read policy on the public reference table.
DROP POLICY IF EXISTS "Anyone can read IRS mileage rates" ON public.irs_mileage_rates;
-- Keeps "Anyone can view IRS mileage rates" as the single canonical read policy.
