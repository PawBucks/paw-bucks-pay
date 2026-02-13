-- Add 'processing_fees' to the tax_expense_category enum
ALTER TYPE tax_expense_category ADD VALUE IF NOT EXISTS 'processing_fees';