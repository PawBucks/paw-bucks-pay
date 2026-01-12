-- Create table for text/SMS campaigns
CREATE TABLE public.text_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'all',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for individual text message logs
CREATE TABLE public.text_message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.text_campaigns(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.text_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.text_message_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage text campaigns
CREATE POLICY "Admins can manage text campaigns"
ON public.text_campaigns
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins can manage text message logs"
ON public.text_message_logs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'superadmin')
  )
);

-- Create updated_at trigger for text_campaigns
CREATE TRIGGER update_text_campaigns_updated_at
BEFORE UPDATE ON public.text_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();