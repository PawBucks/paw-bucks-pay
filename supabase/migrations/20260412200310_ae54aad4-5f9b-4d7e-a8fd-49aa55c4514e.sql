
ALTER TABLE public.funding_requests DROP CONSTRAINT funding_requests_status_check;
ALTER TABLE public.funding_requests ADD CONSTRAINT funding_requests_status_check CHECK (status IN ('pending', 'in_review', 'approved', 'denied', 'funded'));
