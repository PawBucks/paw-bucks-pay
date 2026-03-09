-- Add 'in_review' as a valid status for funding requests and vet loans
-- No enum constraint exists, status is a text field, so we just need to ensure
-- the admin edge function and UI handle the new status.
-- This is a no-op migration to document the status flow:
-- funding_requests.status: 'pending' -> 'in_review' -> 'approved'/'denied'
-- vet_loans.status: 'pending' -> 'in_review' -> 'approved'/'denied'
SELECT 1;
