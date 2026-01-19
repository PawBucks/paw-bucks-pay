-- SECURITY FIX: Replace overly permissive RLS policies with secure versions
-- The previous policies were too broad - now we make them more restrictive

-- Drop the overly permissive policies we just created
DROP POLICY IF EXISTS "Public can view invoices via access_token" ON public.invoices;
DROP POLICY IF EXISTS "Public can update view_count via access_token" ON public.invoices;
DROP POLICY IF EXISTS "Public can insert invoice activity" ON public.invoice_activity;

-- Create a function to validate invoice access token (for use in RLS policies)
CREATE OR REPLACE FUNCTION public.validate_invoice_access(invoice_id uuid, token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = invoice_id
    AND access_token = token
  )
$$;

-- For invoice payments, we'll use edge functions with service role instead of direct RLS
-- This is more secure as we can validate the access_token server-side

-- Grant the invoice_activity table insert access via service role only for public payment tracking
-- The edge function will handle this securely