-- Create accountant invitations table
CREATE TABLE public.accountant_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  accountant_email TEXT NOT NULL,
  accountant_name TEXT,
  access_token TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{"view_expenses": true, "view_income": true, "view_mileage": true, "add_notes": true, "recategorize": false}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create accountant activity log for audit trail
CREATE TABLE public.accountant_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id UUID NOT NULL REFERENCES public.accountant_invitations(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create accountant notes table for expense annotations
CREATE TABLE public.accountant_expense_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id UUID NOT NULL REFERENCES public.accountant_invitations(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES public.merchant_tax_expenses(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  suggested_category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accountant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountant_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountant_expense_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accountant_invitations
CREATE POLICY "Merchants can view their own invitations"
  ON public.accountant_invitations FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can create invitations"
  ON public.accountant_invitations FOR INSERT
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their invitations"
  ON public.accountant_invitations FOR UPDATE
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can delete their invitations"
  ON public.accountant_invitations FOR DELETE
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- RLS Policies for accountant_activity_log
CREATE POLICY "Merchants can view their activity logs"
  ON public.accountant_activity_log FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- RLS Policies for accountant_expense_notes
CREATE POLICY "Merchants can view notes on their expenses"
  ON public.accountant_expense_notes FOR SELECT
  USING (invitation_id IN (
    SELECT id FROM public.accountant_invitations 
    WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  ));

-- Indexes for performance
CREATE INDEX idx_accountant_invitations_merchant ON public.accountant_invitations(merchant_id);
CREATE INDEX idx_accountant_invitations_token ON public.accountant_invitations(access_token);
CREATE INDEX idx_accountant_activity_log_invitation ON public.accountant_activity_log(invitation_id);
CREATE INDEX idx_accountant_expense_notes_expense ON public.accountant_expense_notes(expense_id);

-- Trigger for updated_at
CREATE TRIGGER update_accountant_invitations_updated_at
  BEFORE UPDATE ON public.accountant_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accountant_expense_notes_updated_at
  BEFORE UPDATE ON public.accountant_expense_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();