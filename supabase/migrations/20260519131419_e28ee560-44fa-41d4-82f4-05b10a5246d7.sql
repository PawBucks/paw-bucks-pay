-- Track PawBucks applied to a booking at request time.
-- These are intent fields only — the wallet is not debited until the merchant
-- confirms the booking. Cancellation should leave the user's wallet untouched.
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS pawbucks_applied bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pawbucks_discount_usd numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_due numeric(10,2);

COMMENT ON COLUMN public.service_bookings.pawbucks_applied IS
  'Raw PawBucks the customer chose to apply at booking request time (1000 PB = $1). Debited from wallet only when booking is confirmed.';
COMMENT ON COLUMN public.service_bookings.pawbucks_discount_usd IS
  'USD value of pawbucks_applied at the time of booking request.';
COMMENT ON COLUMN public.service_bookings.cash_due IS
  'USD remaining to charge after PawBucks discount. Equals total_price - pawbucks_discount_usd.';

-- Sanity guard: applied PB must convert to a value <= total_price
ALTER TABLE public.service_bookings
  DROP CONSTRAINT IF EXISTS service_bookings_pawbucks_within_total;
ALTER TABLE public.service_bookings
  ADD CONSTRAINT service_bookings_pawbucks_within_total
  CHECK (pawbucks_discount_usd >= 0 AND pawbucks_discount_usd <= total_price);