REVOKE ALL ON public.petfest_passport_booths FROM anon, authenticated;

GRANT SELECT (id, name, booth_number, sponsor_name, description, pawbucks_reward,
              is_required, is_active, sort_order, created_at, updated_at)
  ON public.petfest_passport_booths TO anon, authenticated;

GRANT INSERT (name, booth_number, sponsor_name, description, pawbucks_reward,
              is_required, is_active, sort_order),
      UPDATE (name, booth_number, sponsor_name, description, pawbucks_reward,
              is_required, is_active, sort_order),
      DELETE
  ON public.petfest_passport_booths TO authenticated;

GRANT ALL ON public.petfest_passport_booths TO service_role;