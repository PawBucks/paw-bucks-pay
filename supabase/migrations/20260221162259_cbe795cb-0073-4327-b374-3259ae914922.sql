
-- Pet email addresses: unique email per pet for receiving vet documents
CREATE TABLE public.pet_email_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL UNIQUE,
  short_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_pet_email UNIQUE (pet_id)
);

-- Inbound emails received for pets
CREATE TABLE public.pet_inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  pet_email_id UUID NOT NULL REFERENCES public.pet_email_addresses(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Individual documents extracted from inbound emails
CREATE TABLE public.pet_inbound_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  email_id UUID REFERENCES public.pet_inbound_emails(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes INTEGER,
  category TEXT NOT NULL DEFAULT 'uncategorized' CHECK (category IN ('vaccine', 'lab_result', 'prescription', 'imaging', 'surgical', 'dental', 'wellness', 'insurance', 'invoice', 'other', 'uncategorized')),
  ai_confidence NUMERIC(3,2),
  ai_summary TEXT,
  sender_email TEXT,
  sender_name TEXT,
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pet_email_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_inbound_documents ENABLE ROW LEVEL SECURITY;

-- RLS: Pet owners can read their own pet email addresses
CREATE POLICY "Pet owners can view their pet email addresses"
  ON public.pet_email_addresses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_email_addresses.pet_id
      AND (pp.user_id = auth.uid() OR public.is_shared_member_of(pp.user_id))
    )
  );

-- RLS: Pet owners can view inbound emails for their pets
CREATE POLICY "Pet owners can view their pet inbound emails"
  ON public.pet_inbound_emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_inbound_emails.pet_id
      AND (pp.user_id = auth.uid() OR public.is_shared_member_of(pp.user_id))
    )
  );

-- RLS: Pet owners can view inbound documents for their pets
CREATE POLICY "Pet owners can view their pet inbound documents"
  ON public.pet_inbound_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_inbound_documents.pet_id
      AND (pp.user_id = auth.uid() OR public.is_shared_member_of(pp.user_id))
    )
  );

-- RLS: Pet owners can update review status of documents
CREATE POLICY "Pet owners can update their pet inbound documents"
  ON public.pet_inbound_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_inbound_documents.pet_id
      AND (pp.user_id = auth.uid() OR public.is_shared_member_of(pp.user_id))
    )
  );

-- Vets can view documents for pets they have access to
CREATE POLICY "Vets can view pet inbound documents"
  ON public.pet_inbound_documents FOR SELECT
  TO authenticated
  USING (
    public.vet_can_view_pet(auth.uid(), pet_id)
  );

-- Create storage bucket for inbound email attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('pet-email-attachments', 'pet-email-attachments', false);

-- Storage RLS: Pet owners can read their pet attachments
CREATE POLICY "Pet owners can read email attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pet-email-attachments'
    AND EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id::text = (storage.foldername(name))[1]
      AND (pp.user_id = auth.uid() OR public.is_shared_member_of(pp.user_id))
    )
  );

-- Function to generate a unique short code for pet email
CREATE OR REPLACE FUNCTION public.generate_pet_email_short_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM pet_email_addresses WHERE short_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$$;

-- Auto-create pet email address when a pet profile is created
CREATE OR REPLACE FUNCTION public.create_pet_email_on_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_short_code TEXT;
  v_email TEXT;
BEGIN
  v_short_code := generate_pet_email_short_code();
  v_email := v_short_code || '@inbox.pawbucks.app';
  
  INSERT INTO public.pet_email_addresses (pet_id, email_address, short_code)
  VALUES (NEW.id, v_email, v_short_code)
  ON CONFLICT (pet_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_pet_email_trigger
  AFTER INSERT ON public.pet_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_pet_email_on_profile();

-- Generate emails for existing pets
INSERT INTO public.pet_email_addresses (pet_id, email_address, short_code)
SELECT 
  pp.id,
  public.generate_pet_email_short_code() || '@inbox.pawbucks.app',
  public.generate_pet_email_short_code()
FROM public.pet_profiles pp
WHERE NOT EXISTS (
  SELECT 1 FROM public.pet_email_addresses pea WHERE pea.pet_id = pp.id
);

-- Update trigger for updated_at
CREATE TRIGGER update_pet_email_addresses_updated_at
  BEFORE UPDATE ON public.pet_email_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pet_inbound_documents_updated_at
  BEFORE UPDATE ON public.pet_inbound_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
