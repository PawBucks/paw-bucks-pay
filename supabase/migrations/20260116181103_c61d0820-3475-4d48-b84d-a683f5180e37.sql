-- Add new IRS-friendly tax expense categories
ALTER TYPE tax_expense_category ADD VALUE IF NOT EXISTS 'inventory_supplies';
ALTER TYPE tax_expense_category ADD VALUE IF NOT EXISTS 'specialized_equipment';
ALTER TYPE tax_expense_category ADD VALUE IF NOT EXISTS 'merchant_market';

-- Add columns to track savings from PawBucks discounts
ALTER TABLE merchant_tax_expenses 
ADD COLUMN IF NOT EXISTS original_price NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS savings_amount NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_auto_logged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS source_purchase_id TEXT DEFAULT NULL;