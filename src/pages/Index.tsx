import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { PremiumMerchantsBanner } from "@/components/PremiumMerchantsBanner";
import { 
  Wallet, Store, Gift, ArrowRight, Shield, Zap, TrendingUp, CheckCircle, 
  Sparkles, BarChart3, MapPin, AlertTriangle, ShoppingBag, Heart, Users
} from "lucide-react";
import { SocialFollowLinks } from "@/components/SocialFollowLinks";
import logo from "@/assets/logo.png";
import familyPetsHero from "@/assets/family-pets-hero.png";
import familyLifestyleFooter from "@/assets/family-lifestyle-footer.png";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Skip the async admin check if no user - faster redirect
    if (!loading && user) {
      // For most users, redirect immediately to dashboard
      // Admin check happens asynchronously and redirects if needed
      navigate("/dashboard", { replace: true });
      
      // Check admin in background (won't block navigation)
      supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      }).then(({ data: isAdmin }) => {
        if (isAdmin) {
          navigate("/admin", { replace: true });
        }
      });
    }
  }, [user, loading, navigate]);

  // Show minimal loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-hero)] flex items-center justify-center" role="status" aria-label="Loading">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--gradient-hero)] overflow-x-hidden">
      <SEO 
        title="PawBucks - Rewards for Every Dollar You Spend on Your Pet"
        description="Manage pet expenses, discover trusted local services, and earn PawBucks every time you care for your pet. Track spending, find local businesses, and turn everyday pet care into rewards."
        keywords={["pet rewards", "pet expenses", "PawBucks", "pet services", "pet spending tracker", "local pet businesses", "lost pet flyer", "pet store"]}
      />
      <Header menuItems={[
        { label: "Explore Pet Merchants", path: "/discover" },
        { label: "Lost Pets", path: "/lost-pets" },
        { label: "Sign In", path: "/auth?role=pet_owner" }
      ]} />

      <main role="main">
        {/* Hero Section */}
        <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28" aria-labelledby="hero-heading">
          <div className="absolute top-20 right-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-pulse" aria-hidden="true"></div>
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse delay-700" aria-hidden="true"></div>
          
          <div className="relative max-w-4xl mx-auto text-center space-y-6 animate-fade-in">
            <h1 
              id="hero-heading"
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-foreground"
            >
              Everything Your Pet Needs.
              <br />
              <span className="bg-gradient-to-r from-accent via-secondary to-accent bg-clip-text text-transparent">
                Rewards for Every Dollar You Spend.
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Manage pet expenses, discover trusted local services, and earn PawBucks every time you care for your pet.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth?role=pet_owner")}
                className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-xl hover:shadow-2xl transition-all group bg-gradient-to-r from-primary to-primary/80"
              >
                Sign Up as Pet Owner
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">No credit card required</p>
          </div>
        </section>

        {/* Lifestyle Hero Image Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="relative max-w-5xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src={familyPetsHero}
                alt="Happy family enjoying time outdoors with their dog and cat"
                className="w-full h-auto object-cover aspect-[4/3] sm:aspect-[16/9]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-10">
                <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground max-w-lg">
                  Every moment with your pet matters. Make them count — and earn rewards along the way.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Premium Merchants Carousel */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <PremiumMerchantsBanner 
            title="Shop with Premium Merchants"
            rotationInterval={6000}
          />
        </section>

        {/* Why PawBucks Section */}
        <section className="relative bg-gradient-to-br from-accent/5 via-transparent to-primary/5 py-16 sm:py-20" aria-labelledby="why-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-accent">Why PawBucks</span>
              </div>
              <h2 id="why-heading" className="text-3xl sm:text-4xl font-bold">
                Being a great pet parent shouldn't cost more — <span className="text-accent">it should give back.</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Between food, vet visits, grooming, walking, training, and unexpected expenses, pet ownership adds up fast.
                PawBucks helps you stay organized, save money, and get rewarded for the care you already give.
              </p>
            </div>
          </div>
        </section>

        {/* What You Can Do Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20" id="features" aria-labelledby="features-heading">
          <div className="text-center mb-12">
            <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold mb-4">
              What You Can Do <span className="text-accent">with PawBucks</span>
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {/* Earn Rewards */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all border-2 hover:border-accent/30">
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
                <Gift className="w-7 h-7 text-accent" />
              </div>
              <h3 className="text-xl font-bold">Earn Rewards on Everyday Pet Spending</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span>Earn PawBucks when you spend with partner pet businesses</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span>Earn even more with PawPass upgrades</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span>Redeem PawBucks for discounts, services, and pet products</span>
                </li>
              </ul>
              <p className="text-sm font-medium text-accent">1,000 PawBucks = $1 in value</p>
            </Card>

            {/* Track Spending */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all border-2 hover:border-primary/30">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold">See Where Your Pet Money Actually Goes</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <span>Track your pet spending in one place</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <span>Download an annual pet expense report</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <span>Budget smarter and plan for future care</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <span>Track health and veterinary expenses</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground italic">Most pet owners have never seen this data before.</p>
            </Card>

            {/* Discover Businesses */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all border-2 hover:border-secondary/30">
              <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center">
                <MapPin className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="text-xl font-bold">Discover Trusted Local Pet Businesses</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                  <span>Walkers, sitters, groomers, trainers, vets, pet stores & more</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                  <span>One directory of verified local providers</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                  <span>Book services and earn rewards at the same time</span>
                </li>
              </ul>
            </Card>

            {/* Lost Pets */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all border-2 hover:border-destructive/30">
              <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <h3 className="text-xl font-bold">Help Bring Lost Pets Home Faster</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-destructive mt-1 flex-shrink-0" />
                  <span>Create lost pet flyers in minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-destructive mt-1 flex-shrink-0" />
                  <span>Share instantly by text, email, and social</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-destructive mt-1 flex-shrink-0" />
                  <span>Print physical flyers directly from the platform</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-destructive mt-1 flex-shrink-0" />
                  <span>Activate your local pet community when it matters most</span>
                </li>
              </ul>
            </Card>

            {/* Pet Store */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all border-2 hover:border-accent/30">
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
                <ShoppingBag className="w-7 h-7 text-accent" />
              </div>
              <h3 className="text-xl font-bold">Shop the PawBucks Pet Store</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span>Use cash or PawBucks to purchase pet products</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span>Get discounts when you pay with PawBucks</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span>Turn rewards into real savings</span>
                </li>
              </ul>
            </Card>

            {/* Community - Coming Soon */}
            <Card className="p-6 space-y-4 hover:shadow-xl transition-all border-2 hover:border-pink-500/30 relative overflow-hidden">
              <div className="absolute top-3 right-3 px-2 py-1 bg-pink-500/10 text-pink-500 text-xs font-medium rounded-full">
                Coming Soon
              </div>
              <div className="w-14 h-14 rounded-xl bg-pink-500/10 flex items-center justify-center">
                <Heart className="w-7 h-7 text-pink-500" />
              </div>
              <h3 className="text-xl font-bold">Support the Pet Community</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-pink-500 mt-1 flex-shrink-0" />
                  <span>Connect with rescues, shelters, and nonprofits</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-pink-500 mt-1 flex-shrink-0" />
                  <span>Support adoption and animal welfare efforts</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-pink-500 mt-1 flex-shrink-0" />
                  <span>Give back while caring for your own pet</span>
                </li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Subscription Tiers */}
        <section className="relative bg-gradient-to-br from-primary/5 via-transparent to-accent/5 py-16 sm:py-20" aria-labelledby="subscriptions-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 id="subscriptions-heading" className="text-3xl sm:text-4xl font-bold mb-4">
                Simple Subscriptions
              </h2>
              <p className="text-lg text-muted-foreground">
                Choose how much you want to earn — upgrading is optional.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
              {/* Free */}
              <Card className="p-6 space-y-4 border-2 hover:shadow-xl transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Gift className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">Free</h3>
                </div>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                    <span>Earn <strong className="text-foreground">10 PawBucks</strong> for every $1 spent at partner pet businesses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                    <span>Access spending, budget, and health tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                    <span>Browse local pet services</span>
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground/70">
                    <span className="w-4 h-4 mt-1 flex-shrink-0">•</span>
                    <span>See ads</span>
                  </li>
                </ul>
              </Card>

              {/* PawPass */}
              <Card className="p-6 space-y-4 border-2 border-yellow-500/40 bg-yellow-500/5 hover:shadow-xl transition-all relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500 text-yellow-950 text-xs font-bold rounded-full">
                  POPULAR
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">PawPass</h3>
                    <p className="text-sm text-muted-foreground">$10/month</p>
                  </div>
                </div>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-yellow-600 mt-1 flex-shrink-0" />
                    <span>Earn <strong className="text-foreground">20 PawBucks</strong> for every $1 spent at partner pet businesses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-yellow-600 mt-1 flex-shrink-0" />
                    <span>Fewer ads</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-yellow-600 mt-1 flex-shrink-0" />
                    <span>Higher rewards, same great tools</span>
                  </li>
                </ul>
              </Card>

              {/* PawPass+ */}
              <Card className="p-6 space-y-4 border-2 border-purple-500/40 bg-purple-500/5 hover:shadow-xl transition-all relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                  BEST VALUE
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">PawPass+</h3>
                    <p className="text-sm text-muted-foreground">$20/month</p>
                  </div>
                </div>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500 mt-1 flex-shrink-0" />
                    <span>Earn <strong className="text-foreground">30 PawBucks</strong> for every $1 spent at partner pet businesses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500 mt-1 flex-shrink-0" />
                    <span>Earn <strong className="text-foreground">5 PawBucks</strong> per $1 spent at non-partner merchants (up to 20,000/month)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500 mt-1 flex-shrink-0" />
                    <span>Ad-free experience</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500 mt-1 flex-shrink-0" />
                    <span>Maximum rewards and flexibility</span>
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground italic">Non-partner rewards vest after 30 days.</p>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20" aria-labelledby="how-it-works-heading">
          <div className="text-center mb-12">
            <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl font-bold mb-4">
              How It Works
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto text-2xl font-bold text-accent">
                1
              </div>
              <h3 className="text-xl font-bold">Sign up for free</h3>
              <p className="text-muted-foreground">Create your account in seconds — no credit card required.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-2xl font-bold text-primary">
                2
              </div>
              <h3 className="text-xl font-bold">Spend on your pet like you already do</h3>
              <p className="text-muted-foreground">Shop at partner pet businesses for food, grooming, vet visits, and more.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto text-2xl font-bold text-secondary">
                3
              </div>
              <h3 className="text-xl font-bold">Earn PawBucks and use them</h3>
              <p className="text-muted-foreground">Redeem for discounts, services, and products at the PawBucks store.</p>
            </div>
          </div>
        </section>

        {/* Why Pet Owners Love PawBucks */}
        <section className="bg-gradient-to-br from-accent/5 via-transparent to-primary/5 py-16 sm:py-20" aria-labelledby="love-heading">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 id="love-heading" className="text-3xl sm:text-4xl font-bold">
                Why Pet Owners <span className="text-accent">Love</span> PawBucks
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                "Rewards without managing points or cards",
                "One platform for spending, services, and tracking",
                "Local businesses, not big-box chains",
                "Real value — not gimmicks",
                "Built by someone who worked in the pet industry for 15+ years",
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
                  <CheckCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Family Lifestyle Image Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="relative max-w-6xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src={familyLifestyleFooter}
                alt="A happy family relaxing at home with their dogs and cat"
                className="w-full h-auto object-cover aspect-[4/3] sm:aspect-[21/9]"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
              <div className="absolute inset-0 flex items-center p-6 sm:p-10 lg:p-14">
                <div className="max-w-md space-y-3">
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                    Real families. Real pets. Real rewards.
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Join thousands of pet owners who are saving money and earning rewards every day.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative py-20 sm:py-24 overflow-hidden bg-gradient-to-br from-accent to-secondary" aria-labelledby="cta-heading">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          
          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <h2 id="cta-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white">
                Smarter Pet Care Starts Here
              </h2>
              <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto">
                Join PawBucks and turn everyday pet spending into rewards, insights, and peace of mind.
              </p>
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="bg-white text-accent hover:bg-white/90 text-base sm:text-lg px-10 py-7 shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
              >
                Create Your Free Account
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 sm:py-16 bg-card/80 backdrop-blur-sm" role="contentinfo">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6">
            <img
              src={logo}
              alt="PawBucks Logo"
              className="h-24 sm:h-32 w-auto object-contain"
              width={96}
              height={96}
              loading="lazy"
            />
            <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">
              Making pet care payments simple, secure, and rewarding for everyone who loves pets.
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
                href="/merchants" 
                className="text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => { e.preventDefault(); navigate("/merchants"); }}
              >
                For Merchants
              </a>
            </div>
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
