-- Add sponsored field to merchants table to track paid promotions
ALTER TABLE merchants ADD COLUMN is_sponsored boolean DEFAULT false;

-- Add index for faster queries of sponsored merchants
CREATE INDEX idx_merchants_sponsored ON merchants(is_sponsored) WHERE is_sponsored = true;

-- Add sponsored_until field to track sponsorship expiration
ALTER TABLE merchants ADD COLUMN sponsored_until timestamp with time zone;