
-- 1) Backfill existing rows
UPDATE public.merchants
SET accepts_pawbucks = true,
    accepts_welcome_credit = true
WHERE accepts_pawbucks IS DISTINCT FROM true
   OR accepts_welcome_credit IS DISTINCT FROM true;

UPDATE public.invoices
SET accept_pawbucks = true
WHERE accept_pawbucks IS DISTINCT FROM true;

-- 2) New defaults
ALTER TABLE public.merchants
  ALTER COLUMN accepts_pawbucks SET DEFAULT true,
  ALTER COLUMN accepts_welcome_credit SET DEFAULT true;

ALTER TABLE public.invoices
  ALTER COLUMN accept_pawbucks SET DEFAULT true;

-- 3) Enforce acceptance going forward via triggers
CREATE OR REPLACE FUNCTION public.enforce_merchant_pawbucks_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.accepts_pawbucks := true;
  NEW.accepts_welcome_credit := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_merchant_pawbucks_acceptance ON public.merchants;
CREATE TRIGGER trg_enforce_merchant_pawbucks_acceptance
BEFORE INSERT OR UPDATE OF accepts_pawbucks, accepts_welcome_credit
ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.enforce_merchant_pawbucks_acceptance();

CREATE OR REPLACE FUNCTION public.enforce_invoice_pawbucks_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.accept_pawbucks := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_pawbucks_acceptance ON public.invoices;
CREATE TRIGGER trg_enforce_invoice_pawbucks_acceptance
BEFORE INSERT OR UPDATE OF accept_pawbucks
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_pawbucks_acceptance();
