REVOKE ALL ON public.vet_lab_integrations FROM anon;
REVOKE ALL ON public.vet_lab_integrations FROM authenticated;
GRANT ALL ON public.vet_lab_integrations TO service_role;

GRANT SELECT (id, vet_id, lab_vendor, lab_name, account_id, api_endpoint, is_active, supports_dicom, auto_import, last_import_at, settings, created_at, updated_at)
  ON public.vet_lab_integrations TO authenticated;
GRANT INSERT (id, vet_id, lab_vendor, lab_name, account_id, api_endpoint, is_active, supports_dicom, auto_import, settings)
  ON public.vet_lab_integrations TO authenticated;
GRANT UPDATE (lab_name, account_id, api_endpoint, is_active, supports_dicom, auto_import, settings)
  ON public.vet_lab_integrations TO authenticated;
GRANT DELETE ON public.vet_lab_integrations TO authenticated;