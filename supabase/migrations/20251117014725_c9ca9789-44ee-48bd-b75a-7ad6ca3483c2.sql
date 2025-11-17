-- Create audit logs table for tracking all admin actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create platform settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create CMS content table
CREATE TABLE IF NOT EXISTS public.cms_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for platform_settings
CREATE POLICY "Admins can manage settings"
ON public.platform_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for cms_content
CREATE POLICY "Admins can manage CMS content"
ON public.cms_content FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view active CMS content"
ON public.cms_content FOR SELECT
TO authenticated
USING (is_active = true);

-- Insert default platform settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('pawbucks_earn_rate', '{"rate": 10, "description": "PawBucks earned per $1 spent"}'::jsonb),
  ('pawbucks_conversion', '{"rate": 10, "description": "PawBucks needed for $1 credit"}'::jsonb),
  ('default_cashback_rate', '{"rate": 10, "description": "Default cashback percentage"}'::jsonb),
  ('platform_fee', '{"rate": 3, "description": "Platform fee percentage on transactions"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action TEXT,
  _entity_type TEXT,
  _entity_id UUID,
  _changes JSONB,
  _ip_address TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, changes, ip_address)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _changes, _ip_address);
END;
$$;