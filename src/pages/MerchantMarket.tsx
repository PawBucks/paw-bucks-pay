import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ServicePurchaseDialog } from "@/components/merchant/ServicePurchaseDialog";
import { ConsultationScheduleDialog } from "@/components/merchant/ConsultationScheduleDialog";
import { toast } from "sonner";
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
  Loader2,
} from "lucide-react";

type ServiceCategory = "visibility" | "analytics" | "growth" | "premium";

type Service = {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  benefits: string[];
  priceUSD: number;
  pricePawBucks: number;
  category: ServiceCategory;
  icon: string | null;
  popular?: boolean;
  newService?: boolean;
  billingPeriod?: "one_time" | "monthly" | "quarterly" | "yearly";
};

// Icon mapping for dynamic rendering
const iconMap: Record<string, React.ReactNode> = {
  Megaphone: <Megaphone className="w-6 h-6" />,
  Star: <Star className="w-6 h-6" />,
  TrendingUp: <TrendingUp className="w-6 h-6" />,
  BadgeCheck: <BadgeCheck className="w-6 h-6" />,
  BarChart3: <BarChart3 className="w-6 h-6" />,
  Users: <Users className="w-6 h-6" />,
  Brain: <Lightbulb className="w-6 h-6" />,
  Search: <Search className="w-6 h-6" />,
  Sparkles: <Sparkles className="w-6 h-6" />,
  Target: <Target className="w-6 h-6" />,
  GraduationCap: <Award className="w-6 h-6" />,
  Palette: <Sparkles className="w-6 h-6" />,
  Crown: <Crown className="w-6 h-6" />,
  Code: <Zap className="w-6 h-6" />,
  Building2: <Building2 className="w-6 h-6" />,
  LineChart: <LineChart className="w-6 h-6" />,
  Rocket: <Rocket className="w-6 h-6" />,
  Video: <Video className="w-6 h-6" />,
  ShieldCheck: <ShieldCheck className="w-6 h-6" />,
  Zap: <Zap className="w-6 h-6" />,
  PieChart: <PieChart className="w-6 h-6" />,
  MessageSquare: <MessageSquare className="w-6 h-6" />,
};

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

type Merchant = {
  id: string;
  business_name: string;
};

const MerchantMarket = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | "all">("all");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [expandedBenefits, setExpandedBenefits] = useState<Set<string>>(new Set());

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Load merchant data
  useEffect(() => {
    const loadMerchant = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("merchants")
          .select("id, business_name")
          .eq("user_id", user.id)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            // No merchant found - redirect to onboarding
            navigate("/merchant-onboarding");
            return;
          }
          throw error;
        }

        setMerchant(data);
      } catch (error) {
        console.error("Error loading merchant:", error);
        toast.error("Failed to load merchant data");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadMerchant();
      loadServices();
    }
  }, [user, navigate]);

  // Load services from database
  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('merchant_market_services')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      const transformed: Service[] = (data || []).map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        short_description: s.short_description,
        benefits: Array.isArray(s.features) ? (s.features as string[]) : [],
        priceUSD: Number(s.price_usd),
        pricePawBucks: s.price_pawbucks,
        category: s.category as ServiceCategory,
        icon: s.icon,
        popular: s.is_popular,
        newService: s.is_new,
        billingPeriod: s.billing_type as Service['billingPeriod'],
      }));

      setServices(transformed);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  // Check for successful purchase from redirect
  useEffect(() => {
    if (searchParams.get('purchase') === 'success') {
      toast.success('Service purchased successfully!');
      // Clear the query param
      navigate('/merchant/market', { replace: true });
    }
  }, [searchParams, navigate]);

  const handlePurchase = (service: Service) => {
    if (!user) {
      toast.error('Please log in to purchase services');
      return;
    }
    setSelectedService(service);
    setShowPurchaseDialog(true);
  };

  const handlePurchaseSuccess = () => {
    toast.success(`${selectedService?.name} has been activated for your account!`);
    setSelectedService(null);
    setShowPurchaseDialog(false);
  };

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

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // No merchant found
  if (!merchant) {
    return null;
  }

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
                    {service.icon && iconMap[service.icon] ? iconMap[service.icon] : <Sparkles className="w-6 h-6" />}
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
                  {(expandedBenefits.has(service.id) ? service.benefits : service.benefits.slice(0, 3)).map((benefit, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                  {service.benefits.length > 3 && (
                    <button
                      onClick={() => {
                        setExpandedBenefits(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(service.id)) {
                            newSet.delete(service.id);
                          } else {
                            newSet.add(service.id);
                          }
                          return newSet;
                        });
                      }}
                      className="text-xs text-primary hover:text-primary/80 pl-6 cursor-pointer transition-colors"
                    >
                      {expandedBenefits.has(service.id) 
                        ? "Show less" 
                        : `+${service.benefits.length - 3} more benefits`}
                    </button>
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
                <Button 
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground"
                  onClick={() => handlePurchase(service)}
                >
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
                <Button 
                  className="w-full"
                  onClick={() => handlePurchase({
                    id: 'growth-starter-bundle',
                    name: 'Growth Starter Bundle',
                    description: 'Premium Analytics + Sponsored Placement + Profile Optimization',
                    short_description: 'Everything you need to start growing on PawBucks.',
                    benefits: ['Premium Analytics Dashboard', 'Sponsored Merchant Placement', 'Profile Optimization'],
                    priceUSD: 437,
                    pricePawBucks: 437000,
                    category: 'growth',
                    icon: null,
                    billingPeriod: 'one_time',
                  })}
                >
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
                <Button 
                  className="w-full"
                  onClick={() => handlePurchase({
                    id: 'pro-merchant-bundle',
                    name: 'Pro Merchant Bundle',
                    description: 'Verified Pro Badge + Premium Analytics + Strategy Consultation + Priority Support',
                    short_description: 'Full suite for serious merchants.',
                    benefits: ['Verified Pro Badge', 'Premium Analytics Dashboard', 'Strategy Consultation', 'Priority Support'],
                    priceUSD: 769,
                    pricePawBucks: 769000,
                    category: 'premium',
                    icon: null,
                    billingPeriod: 'one_time',
                  })}
                >
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
          <Button size="lg" onClick={() => setShowConsultationDialog(true)}>
            Schedule Free Consultation
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        {/* Consultation Dialog */}
        <ConsultationScheduleDialog
          open={showConsultationDialog}
          onOpenChange={setShowConsultationDialog}
          merchantName={merchant?.business_name}
        />
      </main>

      {/* Purchase Dialog */}
      {user && (
        <ServicePurchaseDialog
          open={showPurchaseDialog}
          onOpenChange={setShowPurchaseDialog}
          service={selectedService}
          userId={user.id}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
};

export default MerchantMarket;
