
-- Allow merchants to view profiles of users who checked in at their merchant
CREATE POLICY "Merchants can view checkin user profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM checkins c
    JOIN merchants m ON c.merchant_id = m.id
    WHERE c.user_id = profiles.id
      AND m.user_id = auth.uid()
  )
);

-- Allow vets to view profiles of users who checked in at their vet clinic
CREATE POLICY "Vets can view checkin user profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM checkins c
    JOIN partner_vets pv ON c.vet_id = pv.id
    WHERE c.user_id = profiles.id
      AND pv.user_id = auth.uid()
  )
);
