-- Fix 1: pet-email-attachments storage SELECT policy used wrong column reference (pp.name instead of objects.name)
DROP POLICY IF EXISTS "Pet owners can read email attachments" ON storage.objects;

CREATE POLICY "Pet owners can read email attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pet-email-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.pet_profiles pp
    WHERE pp.id::text = (storage.foldername(storage.objects.name))[1]
      AND (pp.user_id = auth.uid() OR public.is_shared_member_of(pp.user_id))
  )
);

-- Fix 2: grooming_breed_profiles was readable by anon — restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view grooming breed profiles" ON public.grooming_breed_profiles;

CREATE POLICY "Authenticated users can view grooming breed profiles"
ON public.grooming_breed_profiles
FOR SELECT
TO authenticated
USING (true);
