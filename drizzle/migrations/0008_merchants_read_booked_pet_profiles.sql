-- Businesses can read pet details for pets attached to bookings at their business.
-- Lets merchant clients keep querying pet_profiles directly (mobile app built-in join)
-- without exposing pets that have no booking relationship with the business.
CREATE POLICY "Merchants can view pets booked at their business"
ON public.pet_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.service_bookings b
    JOIN public.merchants m ON m.id = b.merchant_id
    WHERE b.pet_id = pet_profiles.id
      AND m.user_id = auth.uid()
  )
);