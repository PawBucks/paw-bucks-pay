
-- Create table for tracking actual vehicle expenses
CREATE TABLE public.merchant_vehicle_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('gas', 'repairs', 'tires', 'oil_change', 'insurance', 'registration', 'parking', 'tolls', 'other')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  vehicle_name TEXT,
  tax_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_vehicle_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Merchants can view their own vehicle expenses"
ON public.merchant_vehicle_expenses
FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can insert their own vehicle expenses"
ON public.merchant_vehicle_expenses
FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can update their own vehicle expenses"
ON public.merchant_vehicle_expenses
FOR UPDATE
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can delete their own vehicle expenses"
ON public.merchant_vehicle_expenses
FOR DELETE
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_merchant_vehicle_expenses_updated_at
BEFORE UPDATE ON public.merchant_vehicle_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_merchant_vehicle_expenses_merchant_year ON public.merchant_vehicle_expenses(merchant_id, tax_year);
