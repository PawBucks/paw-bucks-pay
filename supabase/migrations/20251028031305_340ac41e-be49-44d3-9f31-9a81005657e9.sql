-- Create Partner_Vets table
CREATE TABLE public.partner_vets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  stripe_account_id TEXT,
  contact_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_vets ENABLE ROW LEVEL SECURITY;

-- Create Vet_Loans table
CREATE TABLE public.vet_loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id),
  invoice_amount NUMERIC NOT NULL,
  requested_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  term_months INTEGER NOT NULL,
  repayment_schedule JSONB,
  purpose TEXT,
  invoice_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vet_loans ENABLE ROW LEVEL SECURITY;

-- Create Loan_Activity table for auditing
CREATE TABLE public.loan_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.vet_loans(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loan_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_vets
CREATE POLICY "Everyone can view partner vets"
  ON public.partner_vets
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage partner vets"
  ON public.partner_vets
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for vet_loans
CREATE POLICY "Users can view their own loans"
  ON public.vet_loans
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own loans"
  ON public.vet_loans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all loans"
  ON public.vet_loans
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update loans"
  ON public.vet_loans
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for loan_activity
CREATE POLICY "Users can view their own loan activity"
  ON public.loan_activity
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert loan activity"
  ON public.loan_activity
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all loan activity"
  ON public.loan_activity
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for vet invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('vet-invoices', 'vet-invoices', false);

-- RLS Policies for vet-invoices bucket
CREATE POLICY "Users can upload their own invoices"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'vet-invoices' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own invoices"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'vet-invoices' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all invoices"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'vet-invoices' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Add trigger for updated_at
CREATE TRIGGER update_partner_vets_updated_at
  BEFORE UPDATE ON public.partner_vets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vet_loans_updated_at
  BEFORE UPDATE ON public.vet_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();