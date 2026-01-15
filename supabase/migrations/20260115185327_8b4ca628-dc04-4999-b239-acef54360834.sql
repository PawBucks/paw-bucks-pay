-- Create training course modules table
CREATE TABLE public.training_course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create training course lessons table
CREATE TABLE public.training_course_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES public.training_course_modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 10,
    video_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create training course resources table
CREATE TABLE public.training_course_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    resource_type TEXT NOT NULL DEFAULT 'guide' CHECK (resource_type IN ('pdf', 'template', 'checklist', 'guide')),
    download_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_training_lessons_module ON public.training_course_lessons(module_id);
CREATE INDEX idx_training_modules_order ON public.training_course_modules(display_order);
CREATE INDEX idx_training_lessons_order ON public.training_course_lessons(display_order);
CREATE INDEX idx_training_resources_order ON public.training_course_resources(display_order);

-- Enable RLS
ALTER TABLE public.training_course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_course_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for modules - admins can manage, authenticated users can read active
CREATE POLICY "Admins can manage training modules"
ON public.training_course_modules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "Authenticated users can read active training modules"
ON public.training_course_modules
FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS Policies for lessons
CREATE POLICY "Admins can manage training lessons"
ON public.training_course_lessons
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "Authenticated users can read active training lessons"
ON public.training_course_lessons
FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS Policies for resources
CREATE POLICY "Admins can manage training resources"
ON public.training_course_resources
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

CREATE POLICY "Authenticated users can read active training resources"
ON public.training_course_resources
FOR SELECT
TO authenticated
USING (is_active = true);

-- Add updated_at triggers
CREATE TRIGGER update_training_modules_updated_at
BEFORE UPDATE ON public.training_course_modules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_lessons_updated_at
BEFORE UPDATE ON public.training_course_lessons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_resources_updated_at
BEFORE UPDATE ON public.training_course_resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default content (the existing hardcoded content)
INSERT INTO public.training_course_modules (id, title, description, display_order) VALUES
('11111111-1111-1111-1111-111111111111', 'Getting Started with PawBucks', 'Learn the fundamentals of the PawBucks platform', 1),
('22222222-2222-2222-2222-222222222222', 'Customer Engagement Strategies', 'Master the art of attracting and retaining customers', 2),
('33333333-3333-3333-3333-333333333333', 'Analytics & Growth', 'Use data to make smarter business decisions', 3);

INSERT INTO public.training_course_lessons (module_id, title, description, duration_minutes, display_order) VALUES
-- Module 1
('11111111-1111-1111-1111-111111111111', 'Welcome to PawBucks', 'An introduction to the platform and what you can achieve', 8, 1),
('11111111-1111-1111-1111-111111111111', 'Setting Up Your Profile', 'How to create an optimized merchant profile that attracts customers', 12, 2),
('11111111-1111-1111-1111-111111111111', 'Understanding PawBucks Rewards', 'How the rewards system works and how to maximize customer engagement', 10, 3),
-- Module 2
('22222222-2222-2222-2222-222222222222', 'Creating Compelling Offers', 'Design offers that drive customer action and loyalty', 15, 1),
('22222222-2222-2222-2222-222222222222', 'Leveraging Reviews', 'How to encourage and respond to customer reviews', 10, 2),
('22222222-2222-2222-2222-222222222222', 'Building Customer Loyalty', 'Strategies for turning one-time buyers into repeat customers', 14, 3),
-- Module 3
('33333333-3333-3333-3333-333333333333', 'Understanding Your Dashboard', 'A deep dive into your analytics dashboard and key metrics', 12, 1),
('33333333-3333-3333-3333-333333333333', 'Tracking Customer Behavior', 'How to analyze customer patterns and preferences', 11, 2),
('33333333-3333-3333-3333-333333333333', 'Growth Strategies', 'Proven tactics to scale your business on PawBucks', 16, 3),
('33333333-3333-3333-3333-333333333333', 'Premium Services Deep Dive', 'Maximize your ROI with premium platform features', 13, 4);

INSERT INTO public.training_course_resources (title, description, resource_type, download_url, display_order) VALUES
('Merchant Profile Checklist', 'Ensure your profile is fully optimized with this comprehensive checklist', 'checklist', '#', 1),
('Customer Engagement Playbook', 'Step-by-step guide to engaging customers effectively', 'guide', '#', 2),
('Analytics Template', 'Track your key metrics with this spreadsheet template', 'template', '#', 3),
('Growth Strategy Guide', 'Comprehensive guide to scaling your business on PawBucks', 'pdf', '#', 4);