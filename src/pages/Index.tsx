import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { PremiumMerchantsBanner } from "@/components/PremiumMerchantsBanner";
import { Wallet, Store, Gift, ArrowRight, Shield, Zap, Users, TrendingUp, CheckCircle, Sparkles, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (!loading && user) {
        // Check if user is admin
        const { data: isAdmin } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (isAdmin) {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      }
    };

    checkUserAndRedirect();
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-hero)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-lg">Loading your experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--gradient-hero)] overflow-x-hidden">
      <SEO 
        title="PawBucks - Digital Pet Payment Platform"
        description="Connect with trusted pet stores, groomers, and trainers. Earn up to 30x points in PawBucks with every transaction and manage all your pet expenses in one secure digital wallet."
        keywords={["pet payments", "pet wallet", "PawBucks rewards", "pet stores", "groomers", "pet services", "digital wallet", "pet expenses"]}
      />
      <Header menuItems={[
        { label: "Explore Pet Merchants", path: "/discover" },
        { label: "Lost Pets", path: "/lost-pets" },
        { label: "For Pet Merchants", path: "/merchants" }
      ]} />

      {/* Hero Section */}
      <main role="main">
        <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24" aria-labelledby="hero-heading">
          {/* Decorative Elements */}
          <div className="absolute top-20 right-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-pulse" aria-hidden="true"></div>
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse delay-700" aria-hidden="true"></div>
          
          <div className="relative max-w-5xl mx-auto text-center space-y-8 animate-fade-in">
            
            <h1 
              id="hero-heading"
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-foreground"
            >
              Get Rewards Every Time
              <br />
              <span className="bg-gradient-to-r from-accent via-secondary to-accent bg-clip-text text-transparent">
                You Spend on Your Pet.
              </span>
            </h1>
            
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Connect with pet stores, groomers, trainers, and more to earn points and manage your pet's expenses.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-xl hover:shadow-2xl transition-all group bg-gradient-to-r from-primary to-primary/80"
                aria-label="Start using PawBucks for free"
              >
                Start Earning PawBucks 
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 border-2 hover:bg-accent/5 backdrop-blur-sm"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                aria-label="Learn more about PawBucks features"
              >
                Learn More
              </Button>
            </div>


            {/* Earning Explainer Banner */}
            <div className="mt-12 max-w-4xl mx-auto">
              <div className="relative overflow-hidden rounded-2xl border-2 border-accent/30 bg-gradient-to-r from-accent/10 via-primary/5 to-accent/10 p-6 sm:p-8">
                {/* Shimmer background */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                
                {/* Confetti particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                  {/* Floating sparkles */}
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={`sparkle-${i}`}
                      className="absolute animate-sparkle"
                      style={{
                        left: `${8 + i * 8}%`,
                        top: `${10 + (i % 3) * 30}%`,
                        animationDelay: `${i * 0.3}s`,
                        animationDuration: `${2 + (i % 3)}s`,
                      }}
                    >
                      <Sparkles className="w-3 h-3 text-accent/60" />
                    </div>
                  ))}
                  
                  {/* Floating dots/confetti */}
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={`confetti-${i}`}
                      className="absolute rounded-full animate-float"
                      style={{
                        width: `${4 + (i % 3) * 2}px`,
                        height: `${4 + (i % 3) * 2}px`,
                        left: `${5 + i * 4.5}%`,
                        top: `${-10 + (i % 5) * 25}%`,
                        backgroundColor: [
                          'hsl(var(--accent) / 0.4)',
                          'hsl(var(--primary) / 0.4)',
                          'hsl(45 100% 60% / 0.5)',
                          'hsl(280 80% 60% / 0.4)',
                        ][i % 4],
                        animationDelay: `${i * 0.15}s`,
                        animationDuration: `${2.5 + (i % 4) * 0.5}s`,
                      }}
                    />
                  ))}
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-accent animate-pulse" />
                    <h3 className="text-lg sm:text-xl font-bold text-center animate-bounce-in">How You Earn PawBucks</h3>
                    <Sparkles className="w-5 h-5 text-accent animate-pulse" />
                  </div>
                  
                  <p className="text-center text-muted-foreground mb-6 max-w-2xl mx-auto">
                    Every dollar you spend earns PawBucks rewards. The more you upgrade, the more you earn!
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    {/* Free Tier */}
                    <div className="text-center p-4 rounded-xl bg-background/50 border border-border/50 animate-bounce-in" style={{ animationDelay: '0.1s' }}>
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted/50 mb-2">
                        <Gift className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Free</div>
                      <div className="text-2xl sm:text-3xl font-bold text-foreground">10x</div>
                      <div className="text-xs text-muted-foreground mt-1">$1 = 10 PawBucks</div>
                      <div className="mt-2 text-xs text-muted-foreground/80">
                        $100 spend = 1,000 PawBucks
                      </div>
                    </div>
                    
                    {/* PawPass Tier */}
                    <div className="text-center p-4 rounded-xl bg-yellow-500/10 border-2 border-yellow-500/30 relative animate-bounce-in" style={{ animationDelay: '0.2s' }}>
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-yellow-500 text-yellow-950 text-xs font-bold rounded-full">
                        POPULAR
                      </div>
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20 mb-2">
                        <Zap className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div className="text-sm font-medium text-yellow-600 mb-1">PawPass</div>
                      <div className="text-2xl sm:text-3xl font-bold text-yellow-600">20x</div>
                      <div className="text-xs text-yellow-600/80 mt-1">$1 = 20 PawBucks</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        $100 spend = 2,000 PawBucks
                      </div>
                    </div>
                    
                    {/* PawPass+ Tier */}
                    <div className="text-center p-4 rounded-xl bg-purple-500/10 border-2 border-purple-500/30 relative animate-bounce-in" style={{ animationDelay: '0.3s' }}>
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded-full">
                        BEST VALUE
                      </div>
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/20 mb-2">
                        <TrendingUp className="w-5 h-5 text-purple-500" />
                      </div>
                      <div className="text-sm font-medium text-purple-500 mb-1">PawPass+</div>
                      <div className="text-2xl sm:text-3xl font-bold text-purple-500">30x</div>
                      <div className="text-xs text-purple-500/80 mt-1">$1 = 30 PawBucks</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        $100 spend = 3,000 PawBucks
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-center text-xs text-muted-foreground mt-4">
                    1,000 PawBucks = $1.00 in rewards value • Redeem for discounts on future purchases
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Premium Merchants Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <PremiumMerchantsBanner 
            title="Shop with Premium Merchants"
            rotationInterval={6000}
          />
        </section>

        {/* Features Section */}
        <section 
          id="features"
          className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28"
          aria-labelledby="features-heading"
        >
          <div className="text-center mb-12 sm:mb-16 animate-fade-in">
            <h2 id="features-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Everything you need for
              <span className="block bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">pet care payments</span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Streamline your pet expenses with powerful features designed for pet owners and businesses
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            <Card className="group p-8 text-center hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl border-2 hover:border-primary/30">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300" aria-hidden="true">
                <Wallet className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Digital Wallet</h3>
              <p className="text-muted-foreground leading-relaxed">
                Securely store funds and manage all your pet-related expenses in one convenient digital wallet with bank-level security.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl border-2 hover:border-accent/30">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300" aria-hidden="true">
                <Gift className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3 inline-flex items-center gap-2">
                PawBucks Rewards
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs p-3">
                      <p className="font-semibold mb-1">How It Works</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Earn PawBucks on every purchase. Higher tiers = more rewards!
                      </p>
                      <p className="text-xs">1,000 PawBucks = $1.00 in rewards value</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Earn PawBucks with every purchase! Free: $1 = 10 PawBucks. PawPass: $1 = 20 PawBucks. PawPass+: $1 = 30 PawBucks!
              </p>
            </Card>

            <Card className="group p-8 text-center hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl border-2 md:col-span-2 lg:col-span-1 hover:border-secondary/30">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300" aria-hidden="true">
                <Store className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Trusted Merchants</h3>
              <p className="text-muted-foreground leading-relaxed">
                Discover verified pet businesses near you and support local pet care providers with secure payments.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl border-2 hover:border-primary/30">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300" aria-hidden="true">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Secure & Safe</h3>
              <p className="text-muted-foreground leading-relaxed">
                Your transactions are protected with enterprise-grade encryption and fraud detection technology.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl border-2 hover:border-accent/30">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300" aria-hidden="true">
                <Zap className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Instant Payments</h3>
              <p className="text-muted-foreground leading-relaxed">
                Pay in seconds with QR codes or NFC technology at any partner location for lightning-fast checkouts.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl border-2 hover:border-secondary/30">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300" aria-hidden="true">
                <TrendingUp className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Expense Tracking</h3>
              <p className="text-muted-foreground leading-relaxed">
                Monitor your pet spending with detailed analytics and insights to budget better for your furry friends.
              </p>
            </Card>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="bg-gradient-to-br from-accent/5 via-transparent to-primary/5 py-16 sm:py-20 lg:py-28" aria-labelledby="benefits-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 id="benefits-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Why pet owners <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">love</span> PawBucks
                </h2>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">No Hidden Fees</h3>
                    <p className="text-muted-foreground">Transparent pricing with zero surprise charges or monthly fees</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">24/7 Support</h3>
                    <p className="text-muted-foreground">Get help anytime you need it from our dedicated support team</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-secondary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Easy Setup</h3>
                    <p className="text-muted-foreground">Start in minutes with simple onboarding and intuitive interface</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">PawBucks Rewards</h3>
                    <p className="text-muted-foreground">Earn PawBucks with every transaction and redeem for exclusive perks</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20 sm:py-24 lg:py-32 overflow-hidden bg-gradient-to-br from-accent to-secondary" aria-labelledby="cta-heading">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          
          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-4xl mx-auto space-y-6">
              
              <h2 id="cta-heading" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6">
                Ready to get started?
              </h2>
              
              <p className="text-lg sm:text-xl lg:text-2xl text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed">
                Start using PawBucks today to simplify pet care payments and earn rewards.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="bg-white text-accent hover:bg-white/90 text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
                  aria-label="Create your free PawBucks account"
                >
                  Create Free Account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="border-2 border-white text-accent hover:bg-white/10 text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7"
                  aria-label="View features"
                >
                  View Features
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 sm:py-16 bg-card/80 backdrop-blur-sm" role="contentinfo">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="PawBucks Logo"
                className="h-24 sm:h-32 w-auto object-contain"
                width={96}
                height={96}
                loading="lazy"
              />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">
              Making pet care payments simple, secure, and rewarding for everyone who loves pets.
            </p>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} PawBucks. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
