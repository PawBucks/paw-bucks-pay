-- Create expense categories enum for pet business essentials
CREATE TYPE public.tax_expense_category AS ENUM (
  'gas_mileage',
  'pet_supplies_treats',
  'equipment',
  'insurance',
  'marketing_advertising',
  'professional_services',
  'office_supplies',
  'software_subscriptions',
  'training_education',
  'other'
);

-- Create merchant tax expenses table
CREATE TABLE public.merchant_tax_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  category public.tax_expense_category NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT,
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  vendor_name TEXT,
  tax_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_merchant_tax_expenses_merchant_year ON public.merchant_tax_expenses(merchant_id, tax_year);
CREATE INDEX idx_merchant_tax_expenses_category ON public.merchant_tax_expenses(category);

-- Enable RLS
ALTER TABLE public.merchant_tax_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Merchants can view their own expenses"
ON public.merchant_tax_expenses
FOR SELECT
USING (merchant_id IN (
  SELECT id FROM merchants WHERE user_id = auth.uid()
));

CREATE POLICY "Merchants can create their own expenses"
ON public.merchant_tax_expenses
FOR INSERT
WITH CHECK (merchant_id IN (
  SELECT id FROM merchants WHERE user_id = auth.uid()
));

CREATE POLICY "Merchants can update their own expenses"
ON public.merchant_tax_expenses
FOR UPDATE
USING (merchant_id IN (
  SELECT id FROM merchants WHERE user_id = auth.uid()
));

CREATE POLICY "Merchants can delete their own expenses"
ON public.merchant_tax_expenses
FOR DELETE
USING (merchant_id IN (
  SELECT id FROM merchants WHERE user_id = auth.uid()
));

-- Admins can view all expenses
CREATE POLICY "Admins can view all expenses"
ON public.merchant_tax_expenses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_merchant_tax_expenses_updated_at
BEFORE UPDATE ON public.merchant_tax_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();