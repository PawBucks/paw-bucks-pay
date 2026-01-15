-- Create merchant training progress table to track lesson completion
CREATE TABLE public.merchant_training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.training_course_lessons(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(merchant_id, lesson_id)
);

-- Create indexes
CREATE INDEX idx_training_progress_merchant ON public.merchant_training_progress(merchant_id);
CREATE INDEX idx_training_progress_lesson ON public.merchant_training_progress(lesson_id);

-- Enable RLS
ALTER TABLE public.merchant_training_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies - merchants can only see their own progress
CREATE POLICY "Merchants can view their own training progress"
ON public.merchant_training_progress
FOR SELECT
TO authenticated
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can insert their own training progress"
ON public.merchant_training_progress
FOR INSERT
TO authenticated
WITH CHECK (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can update their own training progress"
ON public.merchant_training_progress
FOR UPDATE
TO authenticated
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Admins can view all progress for analytics
CREATE POLICY "Admins can view all training progress"
ON public.merchant_training_progress
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_training_progress_updated_at
BEFORE UPDATE ON public.merchant_training_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();