-- Strictly read-only: strip the default write privileges the platform puts on new views.
revoke insert, update, delete, truncate, references, trigger, maintain
  on public.merchant_booking_pet_profiles from authenticated;
revoke all on public.merchant_booking_pet_profiles from anon;