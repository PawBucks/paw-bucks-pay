import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { Card } from "@/components/ui/card";
import { PawPrint, Wallet, Store, Gift, ArrowRight, Shield, Zap, Users, TrendingUp, CheckCircle, Sparkles, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] overflow-hidden">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm" role="banner">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between" aria-label="Main navigation">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center shadow-lg" aria-hidden="true">
              <PawPrint className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-accent">
              PetalPay
            </h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="icon"
                className="shadow-xl hover:shadow-2xl transition-all hover:scale-105"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card z-50">
              <DropdownMenuItem 
                onClick={() => navigate("/discover")}
                className="cursor-pointer"
              >
                Explore Pet Merchants
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate("/merchants")}
                className="cursor-pointer"
              >
                For Pet Merchants
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>

      {/* Hero Section */}
      <main role="main">
        <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-32" aria-labelledby="hero-heading">
          {/* Decorative Elements */}
          <div className="absolute top-20 right-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-pulse" aria-hidden="true"></div>
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse delay-700" aria-hidden="true"></div>
          
          <div className="relative max-w-5xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 backdrop-blur-sm mb-4">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">Trusted by thousands of pet lovers</span>
            </div>
            
            <h2 
              id="hero-heading"
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-foreground"
            >
              The Payment Platform
              <br />
              <span className="text-accent">
                for Pet Lovers
              </span>
            </h2>
            
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Connect with trusted pet stores, groomers, and trainers. Earn cashback rewards with every transaction
              and keep your pet expenses organized in one secure place.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105 group"
                aria-label="Start using PetalPay for free"
              >
                Start Free 
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 border-2 hover:bg-accent/5"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                aria-label="Learn more about PetalPay features"
              >
                Learn More
              </Button>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-3xl mx-auto pt-16 sm:pt-20">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-1">10K+</div>
                <div className="text-sm sm:text-base text-muted-foreground">Pet Owners</div>
              </div>
              <div className="text-center border-x border-border/50">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-1">500+</div>
                <div className="text-sm sm:text-base text-muted-foreground">Merchants</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-1">$2M+</div>
                <div className="text-sm sm:text-base text-muted-foreground">Processed</div>
              </div>
            </div>
          </div>
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
              <span className="block text-accent">pet care payments</span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Streamline your pet expenses with powerful features designed for pet owners and businesses
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-primary/20 transition-all" aria-hidden="true">
                <Wallet className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Digital Wallet</h3>
              <p className="text-muted-foreground leading-relaxed">
                Securely store funds and manage all your pet-related expenses in one convenient digital wallet with bank-level security.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-accent/20 transition-all" aria-hidden="true">
                <Gift className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Cashback Rewards</h3>
              <p className="text-muted-foreground leading-relaxed">
                Earn points with every purchase and get instant cashback from verified partner merchants and service providers.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2 md:col-span-2 lg:col-span-1">
              <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-secondary/20 transition-all" aria-hidden="true">
                <Store className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Trusted Merchants</h3>
              <p className="text-muted-foreground leading-relaxed">
                Discover verified pet businesses near you and support local pet care providers with secure payments.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-primary/20 transition-all" aria-hidden="true">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Secure & Safe</h3>
              <p className="text-muted-foreground leading-relaxed">
                Your transactions are protected with enterprise-grade encryption and fraud detection technology.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-accent/20 transition-all" aria-hidden="true">
                <Zap className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Instant Payments</h3>
              <p className="text-muted-foreground leading-relaxed">
                Pay in seconds with QR codes or NFC technology at any partner location for lightning-fast checkouts.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-secondary/20 transition-all" aria-hidden="true">
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
        <section className="bg-gradient-to-br from-accent/5 to-primary/5 py-16 sm:py-20 lg:py-28" aria-labelledby="benefits-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 id="benefits-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Why pet owners love PetalPay
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
                    <h3 className="font-bold text-lg mb-2">Rewards Program</h3>
                    <p className="text-muted-foreground">Earn cashback and exclusive perks with every transaction</p>
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
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm mb-2">
                <Users className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">Join 10,000+ happy users</span>
              </div>
              
              <h2 id="cta-heading" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6">
                Ready to get started?
              </h2>
              
              <p className="text-lg sm:text-xl lg:text-2xl text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed">
                Join thousands of pet owners and businesses already using PetalPay to simplify pet care payments.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="bg-white text-accent hover:bg-white/90 text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
                  aria-label="Create your free PetalPay account"
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center shadow-md">
                <PawPrint className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-accent">PetalPay</span>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">
              Making pet care payments simple, secure, and rewarding for everyone who loves pets.
            </p>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} PetalPay. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
