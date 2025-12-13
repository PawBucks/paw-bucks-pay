-- Create budget_settings table for pet owners to set spending limits per category
CREATE TABLE public.budget_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  monthly_limit NUMERIC NOT NULL DEFAULT 0,
  alert_threshold NUMERIC NOT NULL DEFAULT 80, -- Alert when spending reaches this percentage
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

-- Enable RLS
ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own budget settings"
ON public.budget_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own budget settings"
ON public.budget_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget settings"
ON public.budget_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budget settings"
ON public.budget_settings FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_budget_settings_updated_at
BEFORE UPDATE ON public.budget_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();