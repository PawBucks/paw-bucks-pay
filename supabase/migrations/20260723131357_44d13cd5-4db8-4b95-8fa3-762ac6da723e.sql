CREATE OR REPLACE FUNCTION public.vet_can_view_pet(vet_user_id uuid, pet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.vet_care_shares vcs
    JOIN public.partner_vets pv ON pv.id = vcs.vet_id
    WHERE pv.user_id = vet_can_view_pet.vet_user_id
      AND vcs.pet_id = vet_can_view_pet.pet_id
      AND vcs.is_active = true
      AND (vcs.expires_at IS NULL OR vcs.expires_at > now())
  ) OR EXISTS (
    SELECT 1 FROM public.pet_consent_requests pcr
    JOIN public.partner_vets pv ON pv.id = pcr.vet_id
    WHERE pv.user_id = vet_can_view_pet.vet_user_id
      AND pcr.pet_id = vet_can_view_pet.pet_id
      AND pcr.status = 'signed'::consent_status
  ) OR EXISTS (
    SELECT 1 FROM public.pet_medical_visits pmv
    JOIN public.partner_vets pv ON pv.id = pmv.vet_id
    WHERE pv.user_id = vet_can_view_pet.vet_user_id
      AND pmv.pet_id = vet_can_view_pet.pet_id
  )
$function$;