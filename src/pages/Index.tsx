import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { PawPrint, Wallet, Store, Gift, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50" role="banner">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between" aria-label="Main navigation">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md" aria-hidden="true">
              <PawPrint className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              PetalPay
            </h1>
          </div>
          <Button 
            onClick={() => navigate("/auth")} 
            size="lg"
            className="shadow-md hover:shadow-lg transition-all"
            aria-label="Get started with PetalPay"
          >
            Get Started
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <main role="main">
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24 text-center" aria-labelledby="hero-heading">
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
            <h2 
              id="hero-heading"
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
            >
              The Payment Platform for{" "}
              <span className="bg-[var(--gradient-primary)] bg-clip-text text-transparent">
                Pet Lovers
              </span>
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Connect with trusted pet stores, groomers, and trainers. Earn cashback rewards with every transaction
              and keep your pet expenses organized in one secure place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 sm:mt-10">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 shadow-lg hover:shadow-xl transition-all"
                aria-label="Start using PetalPay for free"
              >
                Start Free <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                aria-label="Learn more about PetalPay features"
              >
                Learn More
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section 
          id="features"
          className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20"
          aria-labelledby="features-heading"
        >
          <h2 id="features-heading" className="sr-only">Key Features</h2>
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            <GradientCard gradient className="text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 shadow-md" aria-hidden="true">
                <Wallet className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3">Digital Wallet</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Securely store funds and manage all your pet-related expenses in one convenient digital wallet with bank-level security.
              </p>
            </GradientCard>

            <GradientCard className="text-center hover:scale-105 transition-transform">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4 shadow-md" aria-hidden="true">
                <Gift className="w-8 h-8 sm:w-10 sm:h-10 text-accent" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3">Cashback Rewards</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Earn points with every purchase and get instant cashback from verified partner merchants and service providers.
              </p>
            </GradientCard>

            <GradientCard className="text-center hover:scale-105 transition-transform md:col-span-2 lg:col-span-1">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4 shadow-md" aria-hidden="true">
                <Store className="w-8 h-8 sm:w-10 sm:h-10 text-secondary" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3">Trusted Merchants</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Discover verified pet businesses near you and support local pet care providers with secure payments.
              </p>
            </GradientCard>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-br from-primary/10 to-accent/10 py-16 sm:py-20 lg:py-24" aria-labelledby="cta-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 id="cta-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
              Ready to get started?
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground mb-6 sm:mb-8 max-w-3xl mx-auto">
              Join thousands of pet owners and businesses already using PetalPay to simplify pet care payments.
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 shadow-lg hover:shadow-xl transition-all"
              aria-label="Create your free PetalPay account"
            >
              Create Free Account
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 sm:py-12 bg-card/50" role="contentinfo">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm sm:text-base text-muted-foreground">
            &copy; {new Date().getFullYear()} PetalPay. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
