
-- Add per-status timestamps to service_bookings to power the booking status timeline
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_at timestamptz;

-- Backfill timestamps for existing rows so the timeline is populated
UPDATE public.service_bookings
SET confirmed_at = COALESCE(confirmed_at, updated_at)
WHERE status IN ('confirmed','completed') AND confirmed_at IS NULL;

UPDATE public.service_bookings
SET cancelled_at = COALESCE(cancelled_at, updated_at)
WHERE status = 'cancelled' AND cancelled_at IS NULL;

UPDATE public.service_bookings
SET completed_at = COALESCE(completed_at, updated_at)
WHERE status = 'completed' AND completed_at IS NULL;

UPDATE public.service_bookings
SET no_show_at = COALESCE(no_show_at, updated_at)
WHERE status = 'no_show' AND no_show_at IS NULL;

-- Trigger to stamp the appropriate column when status transitions
CREATE OR REPLACE FUNCTION public.stamp_booking_status_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'confirmed' AND NEW.confirmed_at IS NULL THEN NEW.confirmed_at := now(); END IF;
    IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;
    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
    IF NEW.status = 'no_show'   AND NEW.no_show_at  IS NULL THEN NEW.no_show_at  := now(); END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'confirmed' AND NEW.confirmed_at IS NULL THEN NEW.confirmed_at := now(); END IF;
    IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;
    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
    IF NEW.status = 'no_show'   AND NEW.no_show_at  IS NULL THEN NEW.no_show_at  := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_booking_status_timestamps ON public.service_bookings;
CREATE TRIGGER trg_stamp_booking_status_timestamps
BEFORE INSERT OR UPDATE OF status ON public.service_bookings
FOR EACH ROW
EXECUTE FUNCTION public.stamp_booking_status_timestamps();
