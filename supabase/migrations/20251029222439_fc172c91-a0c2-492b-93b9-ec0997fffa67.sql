-- Create enum for record types
CREATE TYPE public.medical_record_type AS ENUM (
  'vaccination',
  'checkup',
  'surgery',
  'lab_results',
  'prescription',
  'dental',
  'emergency',
  'other'
);

-- Create enum for message sender types
CREATE TYPE public.message_sender_type AS ENUM ('owner', 'vet');

-- Create medical records table
CREATE TABLE public.pet_medical_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type medical_record_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  record_date DATE NOT NULL,
  vet_id UUID REFERENCES public.partner_vets(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vet messages table for communication
CREATE TABLE public.vet_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE SET NULL,
  sender_type message_sender_type NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pet_medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medical records
CREATE POLICY "Owners can view their pets' medical records"
  ON public.pet_medical_records
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert their pets' medical records"
  ON public.pet_medical_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their pets' medical records"
  ON public.pet_medical_records
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their pets' medical records"
  ON public.pet_medical_records
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all medical records"
  ON public.pet_medical_records
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for vet messages
CREATE POLICY "Owners can view their own messages"
  ON public.vet_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can send messages"
  ON public.vet_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND sender_type = 'owner');

CREATE POLICY "Admins can view all messages"
  ON public.vet_messages
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for medical records
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-records', 'medical-records', false);

-- Storage policies for medical records
CREATE POLICY "Owners can view their own medical record files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'medical-records' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners can upload their own medical record files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'medical-records' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners can update their own medical record files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'medical-records' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners can delete their own medical record files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'medical-records' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add trigger for updated_at
CREATE TRIGGER update_pet_medical_records_updated_at
  BEFORE UPDATE ON public.pet_medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_medical_records_pet_id ON public.pet_medical_records(pet_id);
CREATE INDEX idx_medical_records_user_id ON public.pet_medical_records(user_id);
CREATE INDEX idx_vet_messages_user_id ON public.vet_messages(user_id);
CREATE INDEX idx_vet_messages_vet_id ON public.vet_messages(vet_id);