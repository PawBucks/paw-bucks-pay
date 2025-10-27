-- Create funding_requests table
CREATE TABLE public.funding_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  requested_amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  estimated_monthly_sales NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.funding_requests ENABLE ROW LEVEL SECURITY;

-- Merchants can insert their own funding requests
CREATE POLICY "Merchants can insert their own funding requests"
ON public.funding_requests
FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Merchants can view their own funding requests
CREATE POLICY "Merchants can view their own funding requests"
ON public.funding_requests
FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_funding_requests_updated_at
BEFORE UPDATE ON public.funding_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();