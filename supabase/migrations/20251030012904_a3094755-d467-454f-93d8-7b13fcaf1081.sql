-- Add quantity and price fields to pet_medical_records table
ALTER TABLE pet_medical_records
ADD COLUMN quantity integer,
ADD COLUMN price numeric(10, 2);