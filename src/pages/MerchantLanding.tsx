import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PawPrint, CreditCard, TrendingUp, Users, Shield, BarChart3, Zap, CheckCircle, Sparkles, ArrowRight, DollarSign } from "lucide-react";
import logo from "@/assets/logo.png";

const MerchantLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] overflow-hidden">
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm" role="banner">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between" aria-label="Main navigation">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate("/")}
            aria-label="Go to home page"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-accent to-secondary flex items-center justify-center shadow-lg" aria-hidden="true">
              <PawPrint className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-accent">
              PawBucks
            </h1>
          </div>
          <Button 
            onClick={() => navigate("/merchant-onboarding")}
            className="shadow-xl hover:shadow-2xl transition-all hover:scale-105"
          >
            Become A Merchant
          </Button>
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
              <span className="text-sm font-medium text-accent">Trusted by 500+ pet businesses</span>
            </div>
            
            <h2 
              id="hero-heading"
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-foreground"
            >
              Grow Your Pet Business
              <br />
              <span className="text-accent">
                with PawBucks
              </span>
            </h2>
            
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Accept payments seamlessly, reach thousands of pet owners, and grow your revenue with our 
              comprehensive merchant platform designed specifically for pet businesses.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Button 
                size="lg" 
                onClick={() => navigate("/merchant-onboarding")}
                className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105 group"
                aria-label="Start accepting payments with PawBucks"
              >
                Start Accepting Payments
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 border-2 hover:bg-accent/5"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                aria-label="Learn more about merchant features"
              >
                Learn More
              </Button>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-3xl mx-auto pt-16 sm:pt-20">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-1">500+</div>
                <div className="text-sm sm:text-base text-muted-foreground">Active Merchants</div>
              </div>
              <div className="text-center border-x border-border/50">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-1">$2M+</div>
                <div className="text-sm sm:text-base text-muted-foreground">Monthly Volume</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-1">10K+</div>
                <div className="text-sm sm:text-base text-muted-foreground">Customers</div>
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
              Everything you need to
              <span className="block text-accent">run your pet business</span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful tools and features designed to help pet businesses thrive and grow
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-primary/20 transition-all" aria-hidden="true">
                <CreditCard className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Easy Payments</h3>
              <p className="text-muted-foreground leading-relaxed">
                Accept payments instantly via QR codes, NFC, or online with seamless integration and fast processing.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-accent/20 transition-all" aria-hidden="true">
                <Users className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Reach More Customers</h3>
              <p className="text-muted-foreground leading-relaxed">
                Get discovered by thousands of pet owners actively looking for trusted pet services and products.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2 md:col-span-2 lg:col-span-1">
              <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-secondary/20 transition-all" aria-hidden="true">
                <BarChart3 className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Business Analytics</h3>
              <p className="text-muted-foreground leading-relaxed">
                Track sales, monitor growth, and gain insights with real-time analytics and detailed reporting tools.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-primary/20 transition-all" aria-hidden="true">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Secure Transactions</h3>
              <p className="text-muted-foreground leading-relaxed">
                Enterprise-grade security protects every transaction with advanced fraud detection and encryption.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-accent/20 transition-all" aria-hidden="true">
                <Zap className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Quick Setup</h3>
              <p className="text-muted-foreground leading-relaxed">
                Get started in minutes with simple onboarding and start accepting payments the same day.
              </p>
            </Card>

            <Card className="group p-8 text-center hover:scale-105 transition-all duration-300 hover:shadow-2xl border-2">
              <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-6 shadow-md group-hover:scale-110 group-hover:bg-secondary/20 transition-all" aria-hidden="true">
                <TrendingUp className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Increase Revenue</h3>
              <p className="text-muted-foreground leading-relaxed">
                Boost sales with promotional tools, loyalty programs, and access to our engaged customer base.
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
                  Why pet businesses choose PawBucks
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
                    <h3 className="font-bold text-lg mb-2">Competitive Rates</h3>
                    <p className="text-muted-foreground">Low transaction fees with transparent pricing and no hidden charges</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Fast Payouts</h3>
                    <p className="text-muted-foreground">Get your funds quickly with next-day settlements and instant transfers</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-secondary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Dedicated Support</h3>
                    <p className="text-muted-foreground">24/7 merchant support from a team that understands pet businesses</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Marketing Tools</h3>
                    <p className="text-muted-foreground">Promote your business and attract new customers through our platform</p>
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
                <DollarSign className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">Join 500+ successful merchants</span>
              </div>
              
              <h2 id="cta-heading" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6">
                Ready to grow your business?
              </h2>
              
              <p className="text-lg sm:text-xl lg:text-2xl text-white/90 mb-10 max-w-3xl mx-auto leading-relaxed">
                Join hundreds of pet businesses already growing their revenue with PawBucks's merchant platform.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/merchant-onboarding")}
                  className="bg-white text-accent hover:bg-white/90 text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
                  aria-label="Start your merchant account"
                >
                  Start Your Merchant Account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="border-2 border-white text-accent hover:bg-white/10 text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7"
                  aria-label="View merchant features"
                >
                  View Merchant Features
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
                className="h-12 w-auto object-contain"
              />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">
              Empowering pet businesses with seamless payment solutions and growth opportunities.
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

export default MerchantLanding;
