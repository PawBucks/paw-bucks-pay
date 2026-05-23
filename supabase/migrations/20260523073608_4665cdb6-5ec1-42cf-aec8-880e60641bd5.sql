-- Block client roles from reading the sensitive check-in QR token column.
-- Postgres column privileges are checked before RLS, so this hides the column
-- from every client query while leaving the rest of the merchants row data
-- governed by existing RLS policies. Service-role (edge functions, triggers)
-- and the table owner are unaffected.
REVOKE SELECT (checkin_qr_token) ON public.merchants FROM authenticated;
REVOKE SELECT (checkin_qr_token) ON public.merchants FROM anon;
REVOKE SELECT (checkin_qr_token) ON public.merchants FROM PUBLIC;