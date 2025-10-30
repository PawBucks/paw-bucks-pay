-- Add vet_name and doctor_name to pet_medical_visits table
ALTER TABLE pet_medical_visits
ADD COLUMN vet_name TEXT,
ADD COLUMN doctor_name TEXT;