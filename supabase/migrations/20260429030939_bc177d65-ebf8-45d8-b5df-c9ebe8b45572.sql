-- Persist Vet Services Disclosure Addendum acceptance for vet onboarding & partner_vets
ALTER TABLE public.pending_onboarding
  ADD COLUMN IF NOT EXISTS agreed_to_vet_addendum boolean NOT NULL DEFAULT false;

ALTER TABLE public.partner_vets
  ADD COLUMN IF NOT EXISTS agreed_to_vet_addendum boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreed_to_vet_addendum_at timestamptz;