-- Add smart onboarding fields to merchants table
-- These fields help tailor the Tax Vault experience

-- Entity type for tax purposes (affects deduction suggestions)
ALTER TABLE public.merchants
ADD COLUMN entity_type TEXT DEFAULT NULL
CHECK (entity_type IN ('sole_proprietor', 'llc', 's_corp', 'c_corp', 'partnership', 'nonprofit'));

-- Country/jurisdiction for tax compliance
ALTER TABLE public.merchants
ADD COLUMN country TEXT DEFAULT 'US';

-- State of incorporation (for LLCs, corps)
ALTER TABLE public.merchants
ADD COLUMN state_of_incorporation TEXT DEFAULT NULL;

-- Working style affects which deductions are relevant
ALTER TABLE public.merchants
ADD COLUMN working_style TEXT DEFAULT NULL
CHECK (working_style IN ('home_based', 'storefront', 'mobile', 'mixed'));

-- Add comment for documentation
COMMENT ON COLUMN public.merchants.entity_type IS 'Business entity type: sole_proprietor, llc, s_corp, c_corp, partnership, nonprofit';
COMMENT ON COLUMN public.merchants.working_style IS 'How the business operates: home_based, storefront, mobile, or mixed';
COMMENT ON COLUMN public.merchants.country IS 'Country of operation (ISO code)';
COMMENT ON COLUMN public.merchants.state_of_incorporation IS 'State where entity is registered (if applicable)';