
-- Fix 1: Change price from integer to numeric to support decimal values like 9.99
ALTER TABLE public.pet_store_items
ALTER COLUMN price TYPE numeric(10,2) USING price::numeric(10,2);

-- Fix 2: Update admin RLS policies to also allow superadmins

DROP POLICY IF EXISTS "Admins can insert items" ON public.pet_store_items;
CREATE POLICY "Admins can insert items" ON public.pet_store_items
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR is_superadmin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can view all items" ON public.pet_store_items;
CREATE POLICY "Admins can view all items" ON public.pet_store_items
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_superadmin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update items" ON public.pet_store_items;
CREATE POLICY "Admins can update items" ON public.pet_store_items
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_superadmin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete items" ON public.pet_store_items;
CREATE POLICY "Admins can delete items" ON public.pet_store_items
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_superadmin(auth.uid())
);
