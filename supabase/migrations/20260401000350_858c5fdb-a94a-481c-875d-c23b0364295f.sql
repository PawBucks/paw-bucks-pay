-- Allow shared account members to view owner's service bookings
CREATE POLICY "Shared members can view owner bookings"
ON public.service_bookings FOR SELECT
TO authenticated
USING (is_shared_member_of(user_id));

-- Allow shared account members to view owner's loyalty punch cards
CREATE POLICY "Shared members can view owner punch cards"
ON public.customer_punch_cards FOR SELECT
TO authenticated
USING (is_shared_member_of(user_id));

-- Allow shared account members to view owner's earned badges
CREATE POLICY "Shared members can view owner badges"
ON public.user_guilt_badges FOR SELECT
TO authenticated
USING (is_shared_member_of(user_id));

-- Allow shared account members to view owner's merchant subscriptions
CREATE POLICY "Shared members can view owner subscriptions"
ON public.merchant_subscriptions FOR SELECT
TO authenticated
USING (is_shared_member_of(user_id));