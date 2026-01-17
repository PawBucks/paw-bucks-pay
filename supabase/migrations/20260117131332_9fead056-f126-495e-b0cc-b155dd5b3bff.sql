-- Create IRS mileage rates table for tracking annual standard mileage deduction rates
CREATE TABLE public.irs_mileage_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_year INTEGER NOT NULL UNIQUE,
  rate_per_mile DECIMAL(5,4) NOT NULL, -- e.g., 0.7250 for 72.5 cents
  effective_date DATE NOT NULL,
  source_url TEXT DEFAULT 'https://www.irs.gov/tax-professionals/standard-mileage-rates',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.irs_mileage_rates ENABLE ROW LEVEL SECURITY;

-- Anyone can read IRS rates (public data)
CREATE POLICY "Anyone can view IRS mileage rates" ON public.irs_mileage_rates
  FOR SELECT USING (true);

-- Only admins can modify rates (we'll handle this via edge function)
CREATE POLICY "Service role can manage IRS rates" ON public.irs_mileage_rates
  FOR ALL USING (auth.role() = 'service_role');

-- Insert current IRS standard mileage rates
INSERT INTO public.irs_mileage_rates (tax_year, rate_per_mile, effective_date, notes) VALUES
  (2024, 0.6700, '2024-01-01', 'IRS Notice 2024-08: 67 cents per mile for business use'),
  (2025, 0.7000, '2025-01-01', 'IRS Notice 2024-80: 70 cents per mile for business use'),
  (2026, 0.7250, '2026-01-01', 'IRS Notice 2025-XX: 72.5 cents per mile for business use');

-- Create index for quick lookups by tax year
CREATE INDEX idx_irs_mileage_rates_tax_year ON public.irs_mileage_rates(tax_year);

-- Add trigger for updated_at
CREATE TRIGGER update_irs_mileage_rates_updated_at
  BEFORE UPDATE ON public.irs_mileage_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();