
CREATE TABLE public.merchant_daily_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  total_sales NUMERIC NOT NULL DEFAULT 0,
  total_usd_processed NUMERIC NOT NULL DEFAULT 0,
  total_pawbucks_credits INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, summary_date)
);

ALTER TABLE public.merchant_daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own daily summaries"
ON public.merchant_daily_summaries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = merchant_daily_summaries.merchant_id
    AND m.user_id = auth.uid()
  )
);

CREATE INDEX idx_merchant_daily_summaries_merchant_date
ON public.merchant_daily_summaries(merchant_id, summary_date DESC);
