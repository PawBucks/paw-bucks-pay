import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, TrendingUp, Shield, BarChart3, CheckCircle, ArrowRight, DollarSign, Sparkles, UserPlus, Settings, Percent, Zap, Store, ShoppingBag, Eye, LineChart, Target } from "lucide-react";
import { SocialFollowLinks } from "@/components/SocialFollowLinks";
import logo from "@/assets/logo.png";
import merchantGroomingHero from "@/assets/merchant-grooming-hero.png";
import merchantStoreLifestyle from "@/assets/merchant-store-lifestyle.png";
import { PremiumMerchantsBanner } from "@/components/PremiumMerchantsBanner";

const MerchantLanding = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO 
        title="For Pet Merchants - Grow Your Business with PawBucks"
        description="Get new paying customers for your pet business — pay only when PawBucks delivers them. No discounts, no ads, no upfront spend. Performance-based customer acquisition."
        keywords={["pet merchant", "pet business payments", "PawBucks merchant", "pet store rewards", "groomer payments", "vet payment platform", "customer acquisition"]}
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
            onClick={() => navigate("/auth?role=merchant")}
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
              Grow Your Pet Business With
              <br />
              <span className="text-accent">
                Customers Who Arrive Ready to Spend
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl lg:text-3xl text-foreground/90 max-w-3xl mx-auto leading-relaxed font-medium">
              Get new paying customers — pay only when PawBucks delivers them.
            </p>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              PawBucks is a pet-focused payments and rewards platform that helps pet businesses acquire customers without discounts, ads, or upfront spend.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth?role=merchant")}
                className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105 group"
                aria-label="Get started as a merchant"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </section>

        {/* Lifestyle Hero Image Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="relative max-w-5xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-muted/50 to-muted">
              <img 
                src={merchantGroomingHero}
                alt="Professional pet groomer working with a Golden Retriever at a grooming salon"
                className="w-full h-auto object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-10">
                <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground max-w-lg drop-shadow-sm">
                  Real pet businesses. Real customers. Real growth.
                </p>
              </div>
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

        {/* Why PawBucks Is Different */}
        <section 
          className="relative bg-gradient-to-br from-accent/5 to-primary/5 py-16 sm:py-20 lg:py-28"
          aria-labelledby="different-heading"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 id="different-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Why PawBucks Is Different
                </h2>
                <p className="text-lg sm:text-xl text-foreground/80 font-medium">
                  Customers Join With Preloaded Spending Power
                </p>
              </div>
              
              <Card className="p-8 sm:p-10 border-2 border-accent/20 shadow-xl mb-8">
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  Every new PawBucks user joins with <span className="font-bold text-foreground">up to $250 in Welcome Credits</span>, released monthly and redeemable only on qualifying purchases (starting at $20+) at PawBucks partner businesses. Credits expire each month if unused — so customers are motivated to spend now, not later.
                </p>
                <p className="text-xl font-semibold text-accent">
                  That means customers come in ready to buy, not browse.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* How a PawBucks Transaction Works */}
        <section 
          id="how-it-works"
          className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28"
          aria-labelledby="how-it-works-heading"
        >
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                How a PawBucks Transaction Works
              </h2>
            </div>

            <Card className="p-8 sm:p-10 border-2 border-primary/20 shadow-xl mb-8">
              <p className="text-lg font-semibold text-foreground mb-6">Example:</p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30">
                  <ShoppingBag className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground">A PawBucks customer spends <span className="font-bold">$75</span></p>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30">
                  <Sparkles className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-foreground">They apply <span className="font-bold">$50 PawBucks</span></p>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <DollarSign className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground font-semibold mb-2">You receive:</p>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
                        <span><span className="font-bold text-foreground">$24.25 USD</span> (withdrawable cash)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
                        <span><span className="font-bold text-foreground">$50 PawBucks</span> you can use on PawBucks Merchant Market services</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6 space-y-3">
                <p className="text-muted-foreground leading-relaxed">
                  PawBucks earns a <span className="font-bold text-foreground">3% performance commission</span> on the cash portion only — and only because we delivered the customer.
                </p>
                <p className="text-lg font-semibold text-accent">
                  No customers = no commission.
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* Turn Customer Spend Into Marketing */}
        <section className="relative bg-gradient-to-br from-primary/5 to-accent/5 py-16 sm:py-20 lg:py-28" aria-labelledby="marketing-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 id="marketing-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Turn Customer Spend Into Marketing
                </h2>
                <p className="text-lg text-muted-foreground">(Not Discounts)</p>
              </div>
              
              <div className="mb-8">
                <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                  Your earned PawBucks are not points or coupons.
                </p>
                <p className="text-lg text-foreground font-medium leading-relaxed mb-8">
                  They are prepaid marketing dollars you can use on any of our 16 Merchant Market services, including:
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-10">
                {[
                  { icon: Eye, label: "Featured placement" },
                  { icon: TrendingUp, label: "Sponsored visibility" },
                  { icon: LineChart, label: "Premium analytics" },
                  { icon: Target, label: "Customer acquisition tools" },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-5 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-accent" />
                    </div>
                    <p className="font-medium">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <p className="text-xl sm:text-2xl font-semibold text-accent italic">
                  "Your first-time customer helps fund your next one."
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Payments & Rewards — Fully Automatic */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28" aria-labelledby="automatic-heading">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="automatic-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                Payments & Rewards — Fully Automatic
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {[
                "Secure payments powered by Stripe",
                "No new hardware or custom POS",
                "Automatic customer rewards",
                "No reward funding or management by merchants",
                "Simple merchant analytics dashboard",
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-4 p-5 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <p className="font-medium">{item}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-xl sm:text-2xl font-semibold text-accent italic">
                "You focus on your business. PawBucks handles the rest."
              </p>
            </div>
          </div>
        </section>

        {/* Simple Setup Section */}
        <section className="relative bg-gradient-to-br from-accent/5 to-primary/5 py-16 sm:py-20 lg:py-28" aria-labelledby="setup-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 id="setup-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Simple Setup
                </h2>
              </div>

              <div className="space-y-6 mb-10">
                <div className="flex items-start gap-6 p-6 rounded-2xl bg-card border border-border/50 hover:shadow-lg transition-all">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-xl mb-2">Sign up and add your business</h3>
                  </div>
                </div>

                <div className="flex items-start gap-6 p-6 rounded-2xl bg-card border border-border/50 hover:shadow-lg transition-all">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-xl mb-2">Connect Stripe and add products/services</h3>
                  </div>
                </div>

                <div className="flex items-start gap-6 p-6 rounded-2xl bg-card border border-border/50 hover:shadow-lg transition-all">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-xl mb-2">Start accepting payments and earning PawBucks</h3>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-lg text-muted-foreground font-medium">No loyalty program to manage.</p>
                <p className="text-lg text-muted-foreground font-medium">No ads to run.</p>
                <p className="text-lg text-muted-foreground font-medium">No upfront cost.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Transparent, Performance-Based Pricing Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28" aria-labelledby="pricing-heading">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="pricing-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                Transparent, Performance-Based Pricing
              </h2>
            </div>

            <Card className="p-8 sm:p-12 border-2 border-primary/20 shadow-xl">
              <div className="grid sm:grid-cols-2 gap-6 mb-8">
                <div className="p-6 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">2.9% + $0.30</h3>
                  </div>
                  <p className="text-muted-foreground">Stripe processing</p>
                </div>

                <div className="p-6 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Percent className="w-5 h-5 text-accent" />
                    <h3 className="font-bold text-lg">3% performance commission</h3>
                  </div>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>• Charged only when PawBucks delivers a paying customer</li>
                    <li>• Applied only to the cash portion of the transaction</li>
                  </ul>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-foreground">No contracts.</p>
                <p className="text-lg font-semibold text-foreground">No subscriptions.</p>
                <p className="text-lg font-semibold text-foreground">No hidden fees.</p>
              </div>
            </Card>
          </div>
        </section>

        {/* Built for Pet Businesses */}
        <section className="relative bg-gradient-to-br from-accent/5 to-primary/5 py-16 sm:py-20 lg:py-28" aria-labelledby="built-for-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 id="built-for-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Built for Pet Businesses
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {[
                  "Veterinarians",
                  "Groomers",
                  "Trainers",
                  "Pet retailers",
                  "Boarding & daycare providers",
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-5 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Store className="w-5 h-5 text-accent" />
                    </div>
                    <p className="font-medium">{item}</p>
                  </div>
                ))}
              </div>

              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-foreground">Real pet businesses.</p>
                <p className="text-lg font-semibold text-foreground">Real customers.</p>
                <p className="text-lg font-semibold text-foreground">Real growth.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Merchant Store Lifestyle Image Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="relative max-w-5xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-muted/50 to-muted">
              <img 
                src={merchantStoreLifestyle}
                alt="Pet store checkout with customer and dog at Happy Paws Pet Supplies"
                className="w-full h-auto object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-10">
                <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-white max-w-lg drop-shadow-lg">
                  Turn customer incentives into measurable growth.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="relative py-20 sm:py-24 lg:py-32 overflow-hidden bg-gradient-to-br from-accent to-secondary" aria-labelledby="cta-heading">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          
          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-4xl mx-auto space-y-6">
              
              <h2 id="cta-heading" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-4">
                Start Growing With PawBucks
              </h2>
              <p className="text-xl sm:text-2xl text-white/90 max-w-2xl mx-auto">
                Become a PawBucks merchant and turn customer incentives into measurable growth.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/merchant-onboarding")}
                  className="bg-white text-accent hover:bg-white/90 text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
                  aria-label="Get started as a PawBucks merchant"
                >
                  👉 Get Started
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
