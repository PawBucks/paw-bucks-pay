-- Add platform_fees category to tax_expense_category enum
ALTER TYPE tax_expense_category ADD VALUE IF NOT EXISTS 'platform_fees';