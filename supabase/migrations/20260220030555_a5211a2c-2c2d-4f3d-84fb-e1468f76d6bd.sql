-- 1. Extend the merchants policy to also cover anon role (needed for merchants_public view with security_invoker=on)
DROP POLICY "Approved merchants are viewable by authenticated users" ON public.merchants;
CREATE POLICY "Approved merchants are publicly viewable"
  ON public.merchants
  FOR SELECT
  TO authenticated, anon
  USING (approval_status = 'approved');

-- 2. Add same policy for partner_vets to prevent the same issue
CREATE POLICY "Approved vets are publicly viewable"
  ON public.partner_vets
  FOR SELECT
  TO authenticated, anon
  USING (approval_status = 'approved');
