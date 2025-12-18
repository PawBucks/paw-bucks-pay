-- Create consultation bookings table
CREATE TABLE public.consultation_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id),
  booking_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(booking_date, time_slot)
);

-- Enable RLS
ALTER TABLE public.consultation_bookings ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookings
CREATE POLICY "Users can view their own bookings"
ON public.consultation_bookings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own bookings
CREATE POLICY "Users can create bookings"
ON public.consultation_bookings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all bookings
CREATE POLICY "Admins can view all bookings"
ON public.consultation_bookings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Admins can update bookings
CREATE POLICY "Admins can update bookings"
ON public.consultation_bookings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Service role can manage all bookings
CREATE POLICY "Service role can manage bookings"
ON public.consultation_bookings
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Anyone can check if a slot is booked (for availability)
CREATE POLICY "Anyone can check slot availability"
ON public.consultation_bookings
FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_consultation_bookings_date_slot ON public.consultation_bookings(booking_date, time_slot);

-- Add updated_at trigger
CREATE TRIGGER update_consultation_bookings_updated_at
BEFORE UPDATE ON public.consultation_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();