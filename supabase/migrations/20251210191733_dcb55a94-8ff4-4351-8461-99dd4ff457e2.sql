-- Create merchant market services table for admin-managed services
CREATE TABLE public.merchant_market_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    category TEXT NOT NULL CHECK (category IN ('visibility', 'analytics', 'growth', 'premium')),
    price_usd NUMERIC NOT NULL DEFAULT 0,
    price_pawbucks INTEGER NOT NULL DEFAULT 0,
    billing_type TEXT NOT NULL DEFAULT 'one_time' CHECK (billing_type IN ('one_time', 'monthly', 'quarterly', 'yearly')),
    features JSONB DEFAULT '[]'::jsonb,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_market_services ENABLE ROW LEVEL SECURITY;

-- Everyone can view active services
CREATE POLICY "Anyone can view active merchant services"
ON public.merchant_market_services
FOR SELECT
USING (is_active = true);

-- Admins can manage all services
CREATE POLICY "Admins can manage merchant services"
ON public.merchant_market_services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_merchant_market_services_updated_at
    BEFORE UPDATE ON public.merchant_market_services
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create merchant service purchases table to track purchases
CREATE TABLE public.merchant_service_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.merchant_market_services(id) ON DELETE CASCADE,
    amount_paid_usd NUMERIC DEFAULT 0,
    amount_paid_pawbucks INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),
    stripe_payment_intent_id TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_service_purchases ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own purchases
CREATE POLICY "Merchants can view their purchases"
ON public.merchant_service_purchases
FOR SELECT
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Merchants can create purchases
CREATE POLICY "Merchants can create purchases"
ON public.merchant_service_purchases
FOR INSERT
WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Admins can manage all purchases
CREATE POLICY "Admins can manage all purchases"
ON public.merchant_service_purchases
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage purchases
CREATE POLICY "Service role can manage purchases"
ON public.merchant_service_purchases
FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role');

-- Create trigger for updated_at
CREATE TRIGGER update_merchant_service_purchases_updated_at
    BEFORE UPDATE ON public.merchant_service_purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default services
INSERT INTO public.merchant_market_services (name, short_description, description, category, price_usd, price_pawbucks, billing_type, features, icon, is_popular, is_new, display_order) VALUES
-- Visibility & Promotion
('Premium Ad Placement', 'Feature your business in premium ad spots', 'Get premium placement in high-traffic areas of the platform. Your ads will appear at the top of search results, featured sections, and on the homepage carousel.', 'visibility', 299, 2541, 'monthly', '["Homepage carousel placement", "Top of search results", "Featured in email newsletters", "Priority in category pages", "Analytics dashboard access"]', 'Megaphone', true, false, 1),
('Sponsored Merchant Placement', 'Appear at the top of merchant listings', 'Be the first merchant pet owners see when browsing. Sponsored placement puts your business front and center in all merchant discovery pages.', 'visibility', 199, 1692, 'monthly', '["Top position in Discover page", "Featured in map view", "Highlighted listing badge", "30-day sponsored period", "Performance tracking"]', 'Star', false, false, 2),
('Search Ranking Booster', 'Improve your visibility in search', 'Boost your search ranking to appear higher in results when pet owners search for services like yours. Includes keyword optimization recommendations.', 'visibility', 149, 1267, 'monthly', '["Higher search ranking", "Keyword optimization tips", "Category boost", "Local search priority", "Monthly performance report"]', 'TrendingUp', false, true, 3),
('"Verified Pro" Badge', 'Stand out with verified credentials', 'Display a verified badge on your profile to build trust with pet owners. Includes background check, license verification, and insurance confirmation.', 'visibility', 99, 842, 'one_time', '["Verified Pro badge on profile", "Trust indicator in search", "Background verification", "License confirmation", "Insurance verification"]', 'BadgeCheck', true, false, 4),

-- Analytics & Insights
('Premium Analytics Dashboard', 'Advanced insights for your business', 'Get deep insights into your business performance with advanced analytics. Track customer behavior, revenue trends, and identify growth opportunities.', 'analytics', 99, 842, 'monthly', '["Customer demographics", "Transaction velocity tracking", "Revenue trend analysis", "Competitive benchmarking", "Custom date ranges"]', 'BarChart3', true, false, 5),
('Customer Cohort Analysis', 'Understand your customer retention', 'Detailed analysis of customer retention, lifetime value, and purchasing patterns. Identify your most valuable customer segments and optimize your strategy.', 'analytics', 199, 1692, 'one_time', '["Customer retention metrics", "Lifetime value calculation", "Average order value breakdown", "Cohort comparison", "Exportable reports"]', 'Users', false, false, 6),
('Predictive Demand Forecasting', 'AI-powered demand predictions', 'Leverage machine learning to predict future demand for your services. Get recommendations on pricing, inventory, and staffing based on predicted trends.', 'analytics', 399, 3392, 'quarterly', '["AI demand predictions", "Seasonal trend analysis", "Pricing recommendations", "Inventory optimization", "90-day forecast"]', 'Brain', false, true, 7),
('Keyword Performance Insights', 'See what drives customer traffic', 'Discover which search terms bring customers to your business. Optimize your profile and services based on real search data.', 'analytics', 179, 1522, 'quarterly', '["Search term analysis", "Traffic source breakdown", "Conversion tracking", "Keyword recommendations", "Competitor keyword gaps"]', 'Search', false, false, 8),

-- Growth & Optimization
('Merchant Profile Optimization', 'Professional profile makeover', 'Get expert help optimizing your merchant profile. Our team will review and enhance your photos, descriptions, and service listings for maximum impact.', 'growth', 249, 2117, 'one_time', '["Professional photo review", "Description optimization", "Service listing enhancement", "SEO optimization", "Before/after comparison"]', 'Sparkles', false, false, 9),
('Dedicated Strategy Consultation', '1-on-1 growth strategy session', 'Work directly with a PawBucks growth specialist for a 60-minute strategy session. Get personalized recommendations to grow your business on our platform.', 'growth', 349, 2967, 'one_time', '["60-minute 1-on-1 session", "Custom growth strategy", "Competitive analysis", "Action plan document", "30-day follow-up"]', 'Target', true, false, 10),
('Exclusive Training Course', 'Master the PawBucks platform', 'Access our comprehensive training program covering everything from profile optimization to customer engagement strategies. Includes video lessons and resources.', 'growth', 199, 1692, 'one_time', '["10+ video lessons", "Downloadable resources", "Best practices guide", "Case studies", "Certificate of completion"]', 'GraduationCap', false, false, 11),
('Marketing Toolkit', 'Ready-to-use marketing materials', 'Get a complete set of customizable marketing materials including social media templates, email templates, and promotional graphics featuring your business.', 'growth', 149, 1267, 'one_time', '["Social media templates", "Email marketing templates", "Promotional graphics", "Brand guidelines", "Print-ready materials"]', 'Palette', false, true, 12),

-- Premium & Exclusive
('Featured Partner Status', 'Join our featured partners program', 'Become a featured partner with exclusive benefits including priority support, early access to new features, and enhanced visibility across the platform.', 'premium', 499, 4242, 'monthly', '["Featured partner badge", "Priority support line", "Early feature access", "Quarterly business review", "Co-marketing opportunities"]', 'Crown', false, false, 13),
('API Access & Integration', 'Connect your business systems', 'Get API access to integrate PawBucks with your existing business systems. Includes webhook support, custom integrations, and developer support.', 'premium', 299, 2541, 'monthly', '["Full API access", "Webhook support", "Custom integrations", "Developer documentation", "Technical support"]', 'Code', false, true, 14),
('White-Label Solutions', 'Custom branded experiences', 'Create custom branded experiences for your customers. Perfect for franchises or businesses wanting a cohesive brand experience.', 'premium', 799, 6792, 'monthly', '["Custom branding", "Branded customer portal", "Custom domain support", "Dedicated account manager", "Priority development"]', 'Building2', false, false, 15),
('Enterprise Analytics Suite', 'Complete business intelligence', 'The ultimate analytics package combining all our analytics tools plus custom reporting, data exports, and dedicated analyst support.', 'premium', 599, 5092, 'monthly', '["All analytics tools included", "Custom report builder", "Data export (CSV/Excel)", "Dedicated analyst", "Weekly insights calls"]', 'LineChart', true, false, 16);