-- Businesses can read limited pet details for pets attached to bookings at their business.
-- RLS policies cannot restrict columns (only rows), so this view exposes ONLY the
-- permitted columns and enforces the merchant-ownership check in its WHERE clause.
-- The view is owned by postgres and bypasses RLS on the underlying tables, so it
-- works regardless of the caller; the WHERE clause is the access control.
create or replace view public.merchant_booking_pet_profiles as
select distinct p.id,
       p.name,
       p.type,
       p.breed
from public.pet_profiles p
where exists (
  select 1
  from public.service_bookings b
  join public.merchants m on m.id = b.merchant_id
  where b.pet_id = p.id
    and m.user_id = auth.uid()
);

comment on view public.merchant_booking_pet_profiles is
  'Pet details (id, name, type, breed only) for pets attached to bookings at the calling merchant''s business. Read-only, scoped to auth.uid()-owned merchants.';

-- Read access for signed-in users (merchants); no anon access.
revoke all on public.merchant_booking_pet_profiles from anon;
grant select on public.merchant_booking_pet_profiles to authenticated;
grant all on public.merchant_booking_pet_profiles to service_role;