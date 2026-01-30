-- Create invoice_recipients table for additional recipients (CC/BCC)
-- The primary recipient remains on the invoices table; this table stores additional recipients
CREATE TABLE public.invoice_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  recipient_type TEXT NOT NULL DEFAULT 'cc' CHECK (recipient_type IN ('cc', 'bcc')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_invoice_recipients_invoice_id ON public.invoice_recipients(invoice_id);

-- Enable RLS
ALTER TABLE public.invoice_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policy: Merchants can manage recipients for their own invoices
CREATE POLICY "Merchants can manage their invoice recipients"
  ON public.invoice_recipients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.merchants m ON i.merchant_id = m.id
      WHERE i.id = invoice_recipients.invoice_id
      AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.merchants m ON i.merchant_id = m.id
      WHERE i.id = invoice_recipients.invoice_id
      AND m.user_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_invoice_recipients_updated_at
  BEFORE UPDATE ON public.invoice_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();