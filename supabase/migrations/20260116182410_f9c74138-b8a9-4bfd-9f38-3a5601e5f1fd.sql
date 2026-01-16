
-- Create mileage log table for tracking pet commutes
CREATE TABLE public.merchant_mileage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  trip_date DATE NOT NULL,
  trip_type TEXT NOT NULL CHECK (trip_type IN ('pet_commute', 'personal')),
  miles NUMERIC(10,2) NOT NULL CHECK (miles > 0),
  description TEXT,
  destination TEXT,
  vehicle_name TEXT,
  tax_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_mileage_log ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Merchants can view their own mileage logs"
ON public.merchant_mileage_log
FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can insert their own mileage logs"
ON public.merchant_mileage_log
FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can update their own mileage logs"
ON public.merchant_mileage_log
FOR UPDATE
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can delete their own mileage logs"
ON public.merchant_mileage_log
FOR DELETE
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_merchant_mileage_log_updated_at
BEFORE UPDATE ON public.merchant_mileage_log
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_merchant_mileage_log_merchant_year ON public.merchant_mileage_log(merchant_id, tax_year);
