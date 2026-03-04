-- Allow anonymous users to read platform_settings (needed for landing page banner visibility)
DROP POLICY IF EXISTS "Everyone can view settings" ON public.platform_settings;
CREATE POLICY "Everyone can view settings"
ON public.platform_settings FOR SELECT
TO anon, authenticated
USING (true);