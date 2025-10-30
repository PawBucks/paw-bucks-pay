-- Create pet_medical_visits table to group records by visit
CREATE TABLE public.pet_medical_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL,
  user_id UUID NOT NULL,
  visit_date DATE NOT NULL,
  vet_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add visit_id to pet_medical_records to link records to visits
ALTER TABLE public.pet_medical_records 
ADD COLUMN visit_id UUID REFERENCES public.pet_medical_visits(id) ON DELETE CASCADE;

-- Enable RLS on pet_medical_visits
ALTER TABLE public.pet_medical_visits ENABLE ROW LEVEL SECURITY;

-- RLS policies for pet_medical_visits
CREATE POLICY "Owners can view their pets' visits"
ON public.pet_medical_visits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert their pets' visits"
ON public.pet_medical_visits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their pets' visits"
ON public.pet_medical_visits
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their pets' visits"
ON public.pet_medical_visits
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Vets can insert visits for their patients"
ON public.pet_medical_visits
FOR INSERT
WITH CHECK (vet_id IN (SELECT id FROM partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can view visits they created"
ON public.pet_medical_visits
FOR SELECT
USING (vet_id IN (SELECT id FROM partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all visits"
ON public.pet_medical_visits
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_pet_medical_visits_updated_at
BEFORE UPDATE ON public.pet_medical_visits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();