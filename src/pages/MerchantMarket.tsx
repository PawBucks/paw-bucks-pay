import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  PawPrint,
  ArrowLeft,
  Search,
  Megaphone,
  Star,
  BarChart3,
  TrendingUp,
  Target,
  Sparkles,
  Users,
  Video,
  BadgeCheck,
  Rocket,
  Zap,
  Crown,
  ShieldCheck,
  Clock,
  DollarSign,
  ChevronRight,
  Gift,
  Building2,
  LineChart,
  PieChart,
  MessageSquare,
  Lightbulb,
  Award,
  CheckCircle2,
} from "lucide-react";

type ServiceCategory = "visibility" | "analytics" | "growth" | "premium";

type Service = {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  benefits: string[];
  priceUSD: number;
  pricePawBucks: number;
  category: ServiceCategory;
  icon: React.ReactNode;
  popular?: boolean;
  newService?: boolean;
  billingPeriod?: "one-time" | "monthly" | "quarterly" | "annual";
};

const services: Service[] = [
  // Visibility & Promotion
  {
    id: "premium-ad-placement",
    name: "Premium Ad Placement",
    description: "Feature your business in high-visibility ad spots across the platform",
    longDescription: "Get your business front and center with premium advertising placements on the homepage, discover page, and throughout the pet owner journey. Your ads will be displayed to thousands of active pet owners who are ready to spend.",
    benefits: [
      "Homepage banner placement",
      "Discover page featured position",
      "Targeted audience reach",
      "Real-time impression tracking",
      "A/B testing for ad creatives",
    ],
    priceUSD: 199,
    pricePawBucks: 199000,
    category: "visibility",
    icon: <Megaphone className="w-6 h-6" />,
    popular: true,
    billingPeriod: "monthly",
  },
  {
    id: "sponsored-placement",
    name: "Sponsored Merchant Placement",
    description: "Appear at the top of search results and the Discover page",
    longDescription: "Stand out from the competition by securing a sponsored spot at the top of the Discover page. Sponsored merchants get 5x more visibility and significantly higher click-through rates compared to standard listings.",
    benefits: [
      "Top position in Discover page",
      "Priority in search results",
      "Sponsored badge on profile",
      "30-day campaign duration",
      "Performance dashboard access",
    ],
    priceUSD: 149,
    pricePawBucks: 149000,
    category: "visibility",
    icon: <Star className="w-6 h-6" />,
    billingPeriod: "monthly",
  },
  {
    id: "search-ranking-booster",
    name: "Search Ranking Booster",
    description: "Improve your visibility in platform search results",
    longDescription: "Boost your merchant profile's visibility in search results with our proprietary ranking algorithm enhancement. Get discovered by more pet owners actively searching for services like yours.",
    benefits: [
      "Higher search result rankings",
      "Enhanced profile visibility",
      "Category-specific boosting",
      "Competitive edge over others",
      "Weekly ranking reports",
    ],
    priceUSD: 79,
    pricePawBucks: 79000,
    category: "visibility",
    icon: <Rocket className="w-6 h-6" />,
    newService: true,
    billingPeriod: "monthly",
  },

  // Analytics & Insights
  {
    id: "premium-analytics",
    name: "Premium Analytics Dashboard",
    description: "Advanced data views with customer demographics and competitive insights",
    longDescription: "Unlock the full power of your business data with our Premium Analytics Dashboard. Get detailed customer demographics, transaction velocity trends, and competitive benchmarking to make data-driven decisions.",
    benefits: [
      "Customer demographic insights",
      "Transaction velocity analysis",
      "Competitive benchmarking",
      "Revenue forecasting",
      "Custom date range reports",
    ],
    priceUSD: 99,
    pricePawBucks: 99000,
    category: "analytics",
    icon: <BarChart3 className="w-6 h-6" />,
    popular: true,
    billingPeriod: "monthly",
  },
  {
    id: "keyword-insights",
    name: "Keyword Performance Insights",
    description: "Discover which search terms drive customers to your business",
    longDescription: "Understand exactly how pet owners find your business. See which keywords and search terms are driving traffic, optimize your profile content, and capture more of the market you deserve.",
    benefits: [
      "Top performing keywords",
      "Search term trends",
      "Conversion tracking by keyword",
      "SEO optimization tips",
      "Competitor keyword analysis",
    ],
    priceUSD: 179,
    pricePawBucks: 179000,
    category: "analytics",
    icon: <Target className="w-6 h-6" />,
    billingPeriod: "quarterly",
  },
  {
    id: "demand-forecasting",
    name: "Predictive Demand Forecasting",
    description: "AI-powered predictions for customer demand and optimal pricing",
    longDescription: "Leverage advanced AI algorithms to predict customer demand patterns and optimize your pricing strategy. Stay ahead of seasonal trends and maximize revenue with data-driven recommendations.",
    benefits: [
      "30-day demand predictions",
      "Seasonal trend analysis",
      "Dynamic pricing suggestions",
      "Inventory optimization",
      "Revenue maximization tips",
    ],
    priceUSD: 399,
    pricePawBucks: 399000,
    category: "analytics",
    icon: <TrendingUp className="w-6 h-6" />,
    billingPeriod: "quarterly",
  },
  {
    id: "customer-cohort-analysis",
    name: "Customer Cohort Analysis",
    description: "Deep dive into customer retention, LTV, and purchasing patterns",
    longDescription: "Understand your customers better than ever with comprehensive cohort analysis. Track retention rates, lifetime value, and average order value broken down by customer segments.",
    benefits: [
      "Customer retention metrics",
      "Lifetime value calculation",
      "AOV by customer segment",
      "Churn prediction",
      "Re-engagement opportunities",
    ],
    priceUSD: 249,
    pricePawBucks: 249000,
    category: "analytics",
    icon: <PieChart className="w-6 h-6" />,
    billingPeriod: "one-time",
  },

  // Growth & Optimization
  {
    id: "profile-optimization",
    name: "Merchant Profile Optimization",
    description: "Professional review and optimization of your merchant profile",
    longDescription: "Get expert eyes on your merchant profile with our professional optimization service. Our team will review and enhance your profile content, images, and positioning to maximize conversions.",
    benefits: [
      "Professional copywriting",
      "Image optimization guidance",
      "Keyword-rich descriptions",
      "Conversion rate improvement",
      "Before/after comparison",
    ],
    priceUSD: 299,
    pricePawBucks: 299000,
    category: "growth",
    icon: <Sparkles className="w-6 h-6" />,
    billingPeriod: "one-time",
  },
  {
    id: "strategy-consultation",
    name: "Dedicated Strategy Consultation",
    description: "One-on-one session with a platform growth expert",
    longDescription: "Book a personalized 60-minute strategy session with one of our platform growth experts. Get tailored advice on how to grow your business, optimize your presence, and maximize your ROI on PawBucks.",
    benefits: [
      "60-minute strategy call",
      "Custom growth plan",
      "Platform best practices",
      "Competitive analysis",
      "Follow-up action items",
    ],
    priceUSD: 499,
    pricePawBucks: 499000,
    category: "growth",
    icon: <Users className="w-6 h-6" />,
    billingPeriod: "one-time",
  },
  {
    id: "training-webinar",
    name: "Exclusive Training Webinar/Course",
    description: "Access to premium merchant success training and resources",
    longDescription: "Gain access to our exclusive library of training webinars and courses designed specifically for PawBucks merchants. Learn from top performers and industry experts to accelerate your growth.",
    benefits: [
      "10+ hours of training content",
      "Monthly live Q&A sessions",
      "Best practices playbook",
      "Success case studies",
      "Private community access",
    ],
    priceUSD: 199,
    pricePawBucks: 199000,
    category: "growth",
    icon: <Video className="w-6 h-6" />,
    billingPeriod: "annual",
  },
  {
    id: "review-booster",
    name: "Review Generation Campaign",
    description: "Automated system to encourage happy customers to leave reviews",
    longDescription: "Boost your reputation with our automated review generation system. We'll help you identify happy customers and encourage them to share their positive experiences, building social proof that attracts new business.",
    benefits: [
      "Automated review requests",
      "Timing optimization",
      "Response templates",
      "Review monitoring alerts",
      "Reputation management tips",
    ],
    priceUSD: 129,
    pricePawBucks: 129000,
    category: "growth",
    icon: <MessageSquare className="w-6 h-6" />,
    newService: true,
    billingPeriod: "monthly",
  },

  // Premium & Exclusive
  {
    id: "verified-pro-badge",
    name: '"Verified Pro" Badge',
    description: "Exclusive badge that signals trust and quality to customers",
    longDescription: "Stand out as a verified professional with our exclusive Verified Pro badge. This badge signals to pet owners that your business has been vetted for quality, reliability, and excellent customer service.",
    benefits: [
      "Verified Pro badge on profile",
      "Priority customer support",
      "Featured in Pro directory",
      "Trust indicator for customers",
      "Exclusive merchant network access",
    ],
    priceUSD: 349,
    pricePawBucks: 349000,
    category: "premium",
    icon: <BadgeCheck className="w-6 h-6" />,
    popular: true,
    billingPeriod: "annual",
  },
  {
    id: "priority-support",
    name: "Priority Merchant Support",
    description: "Skip the line with dedicated priority support access",
    longDescription: "Get the help you need when you need it with Priority Support. Enjoy faster response times, dedicated support agents, and priority resolution for any issues that arise.",
    benefits: [
      "4-hour response guarantee",
      "Dedicated support agent",
      "Priority issue resolution",
      "Direct phone support line",
      "After-hours availability",
    ],
    priceUSD: 79,
    pricePawBucks: 79000,
    category: "premium",
    icon: <ShieldCheck className="w-6 h-6" />,
    billingPeriod: "monthly",
  },
  {
    id: "early-access",
    name: "Early Access Program",
    description: "Be the first to access new platform features and tools",
    longDescription: "Join our exclusive Early Access Program and be among the first merchants to try new platform features before they're released to everyone. Shape the future of PawBucks with your feedback.",
    benefits: [
      "Beta feature access",
      "Feature request priority",
      "Feedback influence",
      "Early adopter recognition",
      "Exclusive merchant events",
    ],
    priceUSD: 149,
    pricePawBucks: 149000,
    category: "premium",
    icon: <Zap className="w-6 h-6" />,
    newService: true,
    billingPeriod: "annual",
  },
  {
    id: "merchant-spotlight",
    name: "Merchant Spotlight Feature",
    description: "Get featured in our newsletter and social media channels",
    longDescription: "Be the star of our Merchant Spotlight program! Get featured in our email newsletter to thousands of pet owners, highlighted on our social media channels, and showcased as a success story on our blog.",
    benefits: [
      "Newsletter feature article",
      "Social media spotlight",
      "Blog success story",
      "Press kit preparation",
      "Professional photography tips",
    ],
    priceUSD: 599,
    pricePawBucks: 599000,
    category: "premium",
    icon: <Crown className="w-6 h-6" />,
    billingPeriod: "one-time",
  },
];

const categoryInfo: Record<ServiceCategory, { name: string; description: string; icon: React.ReactNode }> = {
  visibility: {
    name: "Visibility & Promotion",
    description: "Boost your presence and get discovered by more pet owners",
    icon: <Megaphone className="w-5 h-5" />,
  },
  analytics: {
    name: "Analytics & Insights",
    description: "Data-driven tools to understand and grow your business",
    icon: <LineChart className="w-5 h-5" />,
  },
  growth: {
    name: "Growth & Optimization",
    description: "Expert services to accelerate your business growth",
    icon: <TrendingUp className="w-5 h-5" />,
  },
  premium: {
    name: "Premium & Exclusive",
    description: "Elite benefits for serious merchants",
    icon: <Crown className="w-5 h-5" />,
  },
};

const MerchantMarket = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | "all">("all");

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatBillingPeriod = (period?: string) => {
    switch (period) {
      case "monthly":
        return "/mo";
      case "quarterly":
        return "/qtr";
      case "annual":
        return "/yr";
      case "one-time":
        return "";
      default:
        return "";
    }
  };

  const getCategoryIcon = (category: ServiceCategory) => {
    return categoryInfo[category].icon;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm safe-area-inset-top">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/merchant-dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Merchant Market</h1>
                <p className="text-xs text-muted-foreground">Grow your business</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Exclusive Merchant Services
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Supercharge Your <span className="text-primary">Business</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Access premium tools, analytics, and promotional services designed to help you attract more customers and grow your revenue on PawBucks.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as ServiceCategory | "all")} className="mb-8">
          <TabsList className="w-full flex-wrap h-auto gap-2 bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              All Services
            </TabsTrigger>
            {Object.entries(categoryInfo).map(([key, info]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
              >
                {info.icon}
                <span className="hidden sm:inline">{info.name}</span>
                <span className="sm:hidden">{info.name.split(" ")[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Category Description */}
        {selectedCategory !== "all" && (
          <div className="mb-8 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {categoryInfo[selectedCategory].icon}
              </div>
              <div>
                <h3 className="font-semibold">{categoryInfo[selectedCategory].name}</h3>
                <p className="text-sm text-muted-foreground">{categoryInfo[selectedCategory].description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Services Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service, index) => (
            <GradientCard
              key={service.id}
              className="group hover:shadow-lg transition-all duration-300 flex flex-col"
              gradient={service.popular}
            >
              <div className="flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {service.icon}
                  </div>
                  <div className="flex gap-2">
                    {service.popular && (
                      <Badge variant="default" className="bg-primary/90">
                        Popular
                      </Badge>
                    )}
                    {service.newService && (
                      <Badge variant="secondary" className="bg-accent text-accent-foreground">
                        New
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold mb-2">{service.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{service.description}</p>

                {/* Benefits */}
                <div className="space-y-2 mb-4">
                  {service.benefits.slice(0, 3).map((benefit, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                  {service.benefits.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-6">
                      +{service.benefits.length - 3} more benefits
                    </p>
                  )}
                </div>
              </div>

              {/* Pricing & CTA */}
              <div className="pt-4 border-t mt-auto">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      ${service.priceUSD}
                      <span className="text-sm font-normal text-muted-foreground">
                        {formatBillingPeriod(service.billingPeriod)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or {service.pricePawBucks.toLocaleString()} PawBucks
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getCategoryIcon(service.category)}
                    <span className="ml-1 capitalize">{service.category}</span>
                  </Badge>
                </div>
                <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
                  Get Started
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </GradientCard>
          ))}
        </div>

        {/* Empty State */}
        {filteredServices.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No services found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filter to find what you're looking for.
            </p>
            <Button variant="outline" onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}>
              Clear Filters
            </Button>
          </div>
        )}

        {/* Featured Bundle Section */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Featured Bundles</h2>
            <p className="text-muted-foreground">Save more with curated service packages</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Growth Bundle */}
            <GradientCard gradient className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <Badge className="mb-4 bg-accent text-accent-foreground">Save 20%</Badge>
                <h3 className="text-xl font-bold mb-2">Growth Starter Bundle</h3>
                <p className="text-muted-foreground mb-4">
                  Everything you need to start growing: Premium Analytics + Sponsored Placement + Profile Optimization
                </p>
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground line-through">$547</p>
                    <p className="text-2xl font-bold">$437</p>
                  </div>
                  <Badge variant="outline">Save $110</Badge>
                </div>
                <Button className="w-full">
                  Get Bundle
                  <Gift className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </GradientCard>

            {/* Premium Bundle */}
            <GradientCard className="relative overflow-hidden border-2 border-primary/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <Badge className="mb-4 bg-primary text-primary-foreground">Best Value</Badge>
                <h3 className="text-xl font-bold mb-2">Pro Merchant Bundle</h3>
                <p className="text-muted-foreground mb-4">
                  Full suite: Verified Pro Badge + Premium Analytics + Strategy Consultation + Priority Support
                </p>
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground line-through">$1,026</p>
                    <p className="text-2xl font-bold">$769</p>
                  </div>
                  <Badge variant="outline">Save $257</Badge>
                </div>
                <Button className="w-full">
                  Get Bundle
                  <Crown className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </GradientCard>
          </div>
        </div>

        {/* Why Invest Section */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Why Invest in Your Business?</h2>
            <p className="text-muted-foreground">Merchants who use our growth services see significant results</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center p-6 rounded-xl bg-muted/30 border">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-7 h-7 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary mb-2">3.2x</p>
              <p className="text-muted-foreground">Average increase in visibility</p>
            </div>
            <div className="text-center p-6 rounded-xl bg-muted/30 border">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-7 h-7 text-accent" />
              </div>
              <p className="text-3xl font-bold text-accent mb-2">47%</p>
              <p className="text-muted-foreground">Average revenue growth</p>
            </div>
            <div className="text-center p-6 rounded-xl bg-muted/30 border">
              <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                <Star className="w-7 h-7 text-secondary" />
              </div>
              <p className="text-3xl font-bold text-secondary mb-2">89%</p>
              <p className="text-muted-foreground">Merchant satisfaction rate</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center p-8 rounded-2xl bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border">
          <Lightbulb className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Not sure where to start?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Book a free 15-minute consultation with our merchant success team to find the perfect services for your business goals.
          </p>
          <Button size="lg">
            Schedule Free Consultation
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  );
};

export default MerchantMarket;
