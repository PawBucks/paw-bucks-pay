
-- Allow admin deletion of merchant/vet accounts by relaxing FK constraints
-- that would otherwise BLOCK the cascade. Historical financial and medical
-- rows are preserved but lose their identifying vet/merchant reference.

-- ===== merchants references =====
ALTER TABLE public.funding_requests
  DROP CONSTRAINT IF EXISTS funding_requests_merchant_id_fkey,
  ALTER COLUMN merchant_id DROP NOT NULL,
  ADD CONSTRAINT funding_requests_merchant_id_fkey
    FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE SET NULL;

ALTER TABLE public.pawbucks_activity
  DROP CONSTRAINT IF EXISTS pawbucks_activity_partner_id_fkey,
  ADD CONSTRAINT pawbucks_activity_partner_id_fkey
    FOREIGN KEY (partner_id) REFERENCES public.merchants(id) ON DELETE SET NULL;

ALTER TABLE public.consultation_bookings
  DROP CONSTRAINT IF EXISTS consultation_bookings_merchant_id_fkey,
  ALTER COLUMN merchant_id DROP NOT NULL,
  ADD CONSTRAINT consultation_bookings_merchant_id_fkey
    FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE SET NULL;

ALTER TABLE public.receipt_submissions
  DROP CONSTRAINT IF EXISTS receipt_submissions_merchant_id_fkey,
  ADD CONSTRAINT receipt_submissions_merchant_id_fkey
    FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE SET NULL;

ALTER TABLE public.vet_wellness_plans
  DROP CONSTRAINT IF EXISTS vet_wellness_plans_merchant_id_fkey,
  ADD CONSTRAINT vet_wellness_plans_merchant_id_fkey
    FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE SET NULL;

-- ===== partner_vets references =====
ALTER TABLE public.vet_loans
  DROP CONSTRAINT IF EXISTS vet_loans_vet_id_fkey,
  ALTER COLUMN vet_id DROP NOT NULL,
  ADD CONSTRAINT vet_loans_vet_id_fkey
    FOREIGN KEY (vet_id) REFERENCES public.partner_vets(id) ON DELETE SET NULL;

ALTER TABLE public.pet_surgical_notes
  DROP CONSTRAINT IF EXISTS pet_surgical_notes_vet_id_fkey,
  ALTER COLUMN vet_id DROP NOT NULL,
  ADD CONSTRAINT pet_surgical_notes_vet_id_fkey
    FOREIGN KEY (vet_id) REFERENCES public.partner_vets(id) ON DELETE SET NULL;

ALTER TABLE public.pet_soap_notes
  DROP CONSTRAINT IF EXISTS pet_soap_notes_vet_id_fkey,
  ALTER COLUMN vet_id DROP NOT NULL,
  ADD CONSTRAINT pet_soap_notes_vet_id_fkey
    FOREIGN KEY (vet_id) REFERENCES public.partner_vets(id) ON DELETE SET NULL;

ALTER TABLE public.pet_lab_results
  DROP CONSTRAINT IF EXISTS pet_lab_results_vet_id_fkey,
  ALTER COLUMN vet_id DROP NOT NULL,
  ADD CONSTRAINT pet_lab_results_vet_id_fkey
    FOREIGN KEY (vet_id) REFERENCES public.partner_vets(id) ON DELETE SET NULL;

ALTER TABLE public.pet_lab_results
  DROP CONSTRAINT IF EXISTS pet_lab_results_reviewed_by_fkey,
  ADD CONSTRAINT pet_lab_results_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.partner_vets(id) ON DELETE SET NULL;

ALTER TABLE public.pet_imaging_records
  DROP CONSTRAINT IF EXISTS pet_imaging_records_vet_id_fkey,
  ALTER COLUMN vet_id DROP NOT NULL,
  ADD CONSTRAINT pet_imaging_records_vet_id_fkey
    FOREIGN KEY (vet_id) REFERENCES public.partner_vets(id) ON DELETE SET NULL;
