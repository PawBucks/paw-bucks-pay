-- Create auth security events table for tracking authentication activity
CREATE TABLE public.auth_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_address text,
  user_agent text,
  email text,
  success boolean NOT NULL DEFAULT false,
  failure_reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_auth_security_events_user_id ON public.auth_security_events(user_id);
CREATE INDEX idx_auth_security_events_created_at ON public.auth_security_events(created_at DESC);
CREATE INDEX idx_auth_security_events_ip_address ON public.auth_security_events(ip_address);
CREATE INDEX idx_auth_security_events_event_type ON public.auth_security_events(event_type);

-- Enable RLS
ALTER TABLE public.auth_security_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view security events
CREATE POLICY "Admins can view all security events"
  ON public.auth_security_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service role can insert security events
CREATE POLICY "Service role can insert security events"
  ON public.auth_security_events
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Create security alerts table for automated threat detection
CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  email text,
  details jsonb DEFAULT '{}',
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX idx_security_alerts_is_resolved ON public.security_alerts(is_resolved);
CREATE INDEX idx_security_alerts_severity ON public.security_alerts(severity);

-- Enable RLS
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage security alerts
CREATE POLICY "Admins can view all security alerts"
  ON public.security_alerts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update security alerts"
  ON public.security_alerts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert security alerts"
  ON public.security_alerts
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Enable realtime for security alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_alerts;
ALTER TABLE public.security_alerts REPLICA IDENTITY FULL;