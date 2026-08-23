-- 1. Hard-revoke every privilege on secret columns for client roles
REVOKE ALL (clover_access_token, clover_refresh_token, api_key_hash) ON public.merchant_pos_integrations FROM anon, authenticated;
REVOKE ALL (secret) ON public.merchant_webhooks FROM anon, authenticated;
REVOKE ALL (api_key_encrypted) ON public.vet_lab_integrations FROM anon, authenticated;
REVOKE ALL (api_key_encrypted, webhook_secret) ON public.vet_pms_integrations FROM anon, authenticated;
-- Ensure no table-wide grants sneak the secrets back in
REVOKE SELECT, INSERT, UPDATE, REFERENCES ON public.merchant_pos_integrations FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, REFERENCES ON public.merchant_webhooks FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, REFERENCES ON public.vet_lab_integrations FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, REFERENCES ON public.vet_pms_integrations FROM anon, authenticated;

-- Re-grant only non-secret columns
GRANT SELECT (id, merchant_id, name, clover_merchant_id, api_key_prefix, clover_token_expires_at, is_active, last_used_at, created_at, updated_at) ON public.merchant_pos_integrations TO authenticated;
GRANT INSERT (merchant_id, name, clover_merchant_id, api_key_prefix, is_active) ON public.merchant_pos_integrations TO authenticated;
GRANT UPDATE (name, clover_merchant_id, is_active) ON public.merchant_pos_integrations TO authenticated;
GRANT DELETE ON public.merchant_pos_integrations TO authenticated;

GRANT SELECT (id, merchant_id, name, url, events, is_active, failure_count, last_triggered_at, created_at, updated_at) ON public.merchant_webhooks TO authenticated;
GRANT INSERT (merchant_id, name, url, events, is_active) ON public.merchant_webhooks TO authenticated;
GRANT UPDATE (name, url, events, is_active) ON public.merchant_webhooks TO authenticated;
GRANT DELETE ON public.merchant_webhooks TO authenticated;

GRANT SELECT (id, vet_id, lab_name, lab_vendor, api_endpoint, account_id, auto_import, supports_dicom, is_active, settings, last_import_at, created_at, updated_at) ON public.vet_lab_integrations TO authenticated;
GRANT INSERT (vet_id, lab_name, lab_vendor, api_endpoint, account_id, auto_import, supports_dicom, is_active, settings) ON public.vet_lab_integrations TO authenticated;
GRANT UPDATE (lab_name, api_endpoint, account_id, auto_import, supports_dicom, is_active, settings) ON public.vet_lab_integrations TO authenticated;
GRANT DELETE ON public.vet_lab_integrations TO authenticated;

GRANT SELECT (id, vet_id, provider, provider_name, api_endpoint, practice_id, client_id, sync_direction, sync_frequency_minutes, is_active, settings, last_sync_at, created_at, updated_at) ON public.vet_pms_integrations TO authenticated;
GRANT INSERT (vet_id, provider, provider_name, api_endpoint, practice_id, client_id, sync_direction, sync_frequency_minutes, is_active, settings) ON public.vet_pms_integrations TO authenticated;
GRANT UPDATE (provider_name, api_endpoint, practice_id, client_id, sync_direction, sync_frequency_minutes, is_active, settings) ON public.vet_pms_integrations TO authenticated;
GRANT DELETE ON public.vet_pms_integrations TO authenticated;

GRANT ALL ON public.merchant_pos_integrations TO service_role;
GRANT ALL ON public.merchant_webhooks TO service_role;
GRANT ALL ON public.vet_lab_integrations TO service_role;
GRANT ALL ON public.vet_pms_integrations TO service_role;

-- 2. Gate vet access to pet health access codes on a confirmed email
DROP POLICY IF EXISTS "Vets can view codes shared with them" ON public.pet_health_access_codes;
CREATE POLICY "Vets can view codes shared with them"
ON public.pet_health_access_codes
FOR SELECT
TO authenticated
USING (
  vet_email = public.get_current_user_email()
  AND public.current_user_email_confirmed()
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now())
);