import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, TrendingUp, Shield, BarChart3, CheckCircle, ArrowRight, DollarSign, Sparkles, UserPlus, Settings, Percent } from "lucide-react";
import { SocialFollowLinks } from "@/components/SocialFollowLinks";
import logo from "@/assets/logo.png";
import { PremiumMerchantsBanner } from "@/components/PremiumMerchantsBanner";

const MerchantLanding = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO 
        title="For Pet Merchants - Grow Your Business with PawBucks"
        description="Join PawBucks as a pet merchant. Accept payments, reward customers automatically, and track sales in one place. Perfect for pet stores, groomers, trainers, and vets."
        keywords={["pet merchant", "pet business payments", "PawBucks merchant", "pet store rewards", "groomer payments", "vet payment platform"]}
      />
      <div className="min-h-screen bg-[var(--gradient-hero)] overflow-hidden">
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm safe-area-inset-top" role="banner">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between" aria-label="Main navigation">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate("/")}
            aria-label="Go to home page"
          >
            <img 
              src={logo} 
              alt="PawBucks Logo" 
              className="h-24 sm:h-32 w-auto object-contain"
            />
          </div>
          <Button 
            onClick={() => navigate("/auth")}
            className="shadow-xl hover:shadow-2xl transition-all hover:scale-105"
          >
            Sign In
          </Button>
        </nav>
      </header>

      <main role="main">
        {/* Hero Section */}
        <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-32" aria-labelledby="hero-heading">
          <div className="absolute top-20 right-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-pulse" aria-hidden="true"></div>
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse delay-700" aria-hidden="true"></div>
          
          <div className="relative max-w-5xl mx-auto text-center space-y-8 animate-fade-in">
            <h1 
              id="hero-heading"
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-foreground"
            >
              Grow Your Pet Business
              <br />
              <span className="text-accent">
                Without Extra Work
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl lg:text-3xl text-foreground/90 max-w-3xl mx-auto leading-relaxed font-medium">
              Accept payments, reward customers automatically, and track your sales — all in one place.
            </p>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              PawBucks is a pet-focused payments and rewards platform built for pet stores, groomers, trainers, and service providers. You get paid through Stripe, customers earn cashback automatically, and everything is tracked in a simple analytics dashboard.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Button 
                size="lg" 
                onClick={() => navigate("/merchant-onboarding")}
                className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105 group"
                aria-label="Get started as a merchant"
              >
                Get Started as a Merchant
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </section>

        {/* Premium Merchants Carousel */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <PremiumMerchantsBanner 
            title="See Who's Already Growing with PawBucks"
            rotationInterval={5000}
            showMultiple={true}
          />
        </section>

        {/* How PawBucks Works Section */}
        <section 
          id="how-it-works"
          className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28"
          aria-labelledby="how-it-works-heading"
        >
          <div className="text-center mb-12 sm:mb-16 animate-fade-in">
            <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              How PawBucks Works for Merchants
            </h2>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-3 max-w-6xl mx-auto">
            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary">
                1
              </div>
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-primary/20 transition-all" aria-hidden="true">
                <CreditCard className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Accept Payments</h3>
              <ul className="text-muted-foreground leading-relaxed text-left space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Secure payments powered by Stripe</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>No new hardware or custom POS required</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Industry-standard payment processing</span>
                </li>
              </ul>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-accent">
                2
              </div>
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-accent/20 transition-all" aria-hidden="true">
                <Sparkles className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Automatic Customer Rewards</h3>
              <ul className="text-muted-foreground leading-relaxed text-left space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>Customers earn PawBucks cashback on purchases</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>Rewards are automatically included</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>Merchants do not fund or manage rewards</span>
                </li>
              </ul>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-secondary">
                3
              </div>
              <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-secondary/20 transition-all" aria-hidden="true">
                <BarChart3 className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Track Sales & Performance</h3>
              <ul className="text-muted-foreground leading-relaxed text-left space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                  <span>View transaction history</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                  <span>Track customer spending</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                  <span>Access analytics in a merchant dashboard</span>
                </li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Rewards Section */}
        <section className="relative bg-gradient-to-br from-accent/5 to-primary/5 py-16 sm:py-20 lg:py-28" aria-labelledby="rewards-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 id="rewards-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Rewards — Without the Headache
                </h2>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6 mb-10">
                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Rewards Funded by PawBucks</h3>
                    <p className="text-muted-foreground">Rewards are funded by the 3% PawBucks platform fee — not by you</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Settings className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">No Configuration Required</h3>
                    <p className="text-muted-foreground">Merchants do not configure reward rates or manage points</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-secondary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">No Redemption Management</h3>
                    <p className="text-muted-foreground">Merchants do not manage points or redemptions</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Zero Extra Setup</h3>
                    <p className="text-muted-foreground">No extra setup required — rewards work automatically</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xl sm:text-2xl font-semibold text-accent italic">
                  "You focus on your business. PawBucks handles the rewards."
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Simple Setup Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28" aria-labelledby="setup-heading">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="setup-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                Simple Setup
              </h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-6 p-6 rounded-2xl bg-card border border-border/50 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2">Sign up and add your business information</h3>
                  <p className="text-muted-foreground">Create your account and tell us about your pet business</p>
                </div>
              </div>

              <div className="flex items-start gap-6 p-6 rounded-2xl bg-card border border-border/50 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2">Set up your product or service catalog in Stripe</h3>
                  <p className="text-muted-foreground">Add your products and services so customers can pay you</p>
                </div>
              </div>

              <div className="flex items-start gap-6 p-6 rounded-2xl bg-card border border-border/50 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2">Start accepting payments and rewarding customers automatically</h3>
                  <p className="text-muted-foreground">That's it — you're ready to grow your business</p>
                </div>
              </div>
            </div>

            <div className="text-center mt-10">
              <p className="text-lg text-muted-foreground font-medium">
                No technical setup. No loyalty program to manage.
              </p>
            </div>
          </div>
        </section>

        {/* Transparent Pricing Section */}
        <section className="relative bg-gradient-to-br from-primary/5 to-accent/5 py-16 sm:py-20 lg:py-28" aria-labelledby="pricing-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 id="pricing-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Transparent Pricing
                </h2>
              </div>

              <Card className="p-8 sm:p-12 text-center border-2 border-primary/20 shadow-xl">
                <div className="mb-8">
                  <p className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-primary mb-2">
                    5.9% + $0.30
                  </p>
                  <p className="text-xl text-muted-foreground">per transaction</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-6 text-left mb-8">
                  <div className="p-6 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <h3 className="font-bold">2.9% + $0.30</h3>
                    </div>
                    <p className="text-muted-foreground">Stripe payment processing</p>
                  </div>

                  <div className="p-6 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Percent className="w-5 h-5 text-accent" />
                      <h3 className="font-bold">3% PawBucks platform fee</h3>
                    </div>
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      <li>• Funds customer rewards</li>
                      <li>• Powers analytics and tracking</li>
                      <li>• Supports customer acquisition</li>
                    </ul>
                  </div>
                </div>

                <p className="text-lg font-semibold text-foreground">
                  No hidden fees. No contracts.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Why Merchants Choose PawBucks Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28" aria-labelledby="why-pawbucks-heading">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="why-pawbucks-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                Why Merchants Choose PawBucks
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "No loyalty program to build or manage",
                "Automatic cashback rewards for customers",
                "Stripe-powered payments",
                "Clear insights into sales and customer behavior",
                "Built specifically for pet businesses"
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-4 p-5 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-accent" />
                  </div>
                  <p className="font-medium">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="relative py-20 sm:py-24 lg:py-32 overflow-hidden bg-gradient-to-br from-accent to-secondary" aria-labelledby="cta-heading">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          
          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-4xl mx-auto space-y-6">
              
              <h2 id="cta-heading" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6">
                Start Growing with PawBucks
              </h2>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/merchant-onboarding")}
                  className="bg-white text-accent hover:bg-white/90 text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
                  aria-label="Join PawBucks as a merchant"
                >
                  Join PawBucks as a Merchant
                  <ArrowRight className="w-5 h-5 ml-2" />
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
              />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">
              The pet-focused payments and rewards platform for growing businesses.
            </p>
            <SocialFollowLinks />
            <div className="flex items-center gap-4 text-sm">
              <a 
                href="/vets" 
                className="text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => { e.preventDefault(); navigate("/vets"); }}
              >
                For Vets
              </a>
              <span className="text-muted-foreground/50">•</span>
              <a 
                href="/" 
                className="text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => { e.preventDefault(); navigate("/"); }}
              >
                For Pet Owners
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} PawBucks. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
};

export default MerchantLanding;
