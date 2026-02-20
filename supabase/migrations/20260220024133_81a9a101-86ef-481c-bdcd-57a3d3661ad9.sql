
-- Create ticket category enum
CREATE TYPE public.ticket_category AS ENUM (
  'technical_issue',
  'billing_payments',
  'account_profile',
  'feature_request',
  'general',
  'other'
);

-- Create ticket priority enum
CREATE TYPE public.ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- Create ticket status enum
CREATE TYPE public.ticket_status AS ENUM (
  'open',
  'in_progress',
  'awaiting_response',
  'resolved',
  'closed'
);

-- Create ticket submitter type enum
CREATE TYPE public.ticket_submitter_type AS ENUM (
  'pet_owner',
  'merchant',
  'vet'
);

-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitter_type ticket_submitter_type NOT NULL DEFAULT 'pet_owner',
  category ticket_category NOT NULL DEFAULT 'general',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  status ticket_status NOT NULL DEFAULT 'open',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  -- Additional context fields for merchants/vets
  affected_feature TEXT,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  browser_info TEXT,
  screenshot_urls TEXT[],
  -- Related entity references
  related_merchant_id UUID REFERENCES public.merchants(id),
  related_vet_id UUID REFERENCES public.partner_vets(id),
  related_transaction_id UUID,
  related_invoice_id UUID,
  -- Assignment and resolution
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ticket replies table
CREATE TABLE public.support_ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL,
  attachment_urls TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generate ticket numbers
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ticket_num TEXT;
  num_exists BOOLEAN;
BEGIN
  LOOP
    ticket_num := 'TKT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 5));
    SELECT EXISTS(SELECT 1 FROM support_tickets WHERE ticket_number = ticket_num) INTO num_exists;
    EXIT WHEN NOT num_exists;
  END LOOP;
  RETURN ticket_num;
END;
$$;

-- Auto-set ticket number on insert
CREATE OR REPLACE FUNCTION public.set_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_ticket_number_trigger
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_ticket_number();

-- Update timestamp trigger
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_tickets
-- Users can view their own tickets
CREATE POLICY "Users can view own tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- Users can create their own tickets
CREATE POLICY "Users can create own tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tickets (e.g., add info)
CREATE POLICY "Users can update own tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can update any ticket
CREATE POLICY "Admins can update all tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- RLS policies for support_ticket_replies
-- Users can view replies on their own tickets
CREATE POLICY "Users can view replies on own tickets"
ON public.support_ticket_replies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND user_id = auth.uid()
  )
);

-- Admins can view all replies
CREATE POLICY "Admins can view all replies"
ON public.support_ticket_replies
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- Users can create replies on their own tickets
CREATE POLICY "Users can create replies on own tickets"
ON public.support_ticket_replies
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND user_id = auth.uid()
  )
);

-- Admins can create replies on any ticket
CREATE POLICY "Admins can create replies on any ticket"
ON public.support_ticket_replies
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
);

-- Create indexes for performance
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX idx_support_ticket_replies_ticket_id ON public.support_ticket_replies(ticket_id);
