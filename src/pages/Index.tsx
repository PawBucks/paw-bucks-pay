import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { PawPrint, Wallet, Store, Gift, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              PetalPay
            </h1>
          </div>
          <Button onClick={() => navigate("/auth")}>Get Started</Button>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-5xl font-bold leading-tight">
              The Payment Platform for{" "}
              <span className="bg-[var(--gradient-primary)] bg-clip-text text-transparent">
                Pet Lovers
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Connect with trusted pet stores, groomers, and trainers. Earn rewards with every transaction
              and keep your pet expenses organized in one place.
            </p>
            <div className="flex gap-4 justify-center mt-8">
              <Button size="lg" onClick={() => navigate("/auth")}>
                Start Free <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <GradientCard gradient className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Digital Wallet</h3>
              <p className="text-muted-foreground">
                Securely store funds and manage all your pet-related expenses in one convenient wallet.
              </p>
            </GradientCard>

            <GradientCard className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-2">Rewards Program</h3>
              <p className="text-muted-foreground">
                Earn points with every purchase and redeem them for discounts at partner locations.
              </p>
            </GradientCard>

            <GradientCard className="text-center">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Trusted Merchants</h3>
              <p className="text-muted-foreground">
                Discover verified pet businesses near you and support local pet care providers.
              </p>
            </GradientCard>
          </div>
        </section>

        <section className="bg-[var(--gradient-hero)] py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to get started?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of pet owners and businesses already using PetalPay to simplify pet care payments.
            </p>
            <Button size="lg" onClick={() => navigate("/auth")}>
              Create Free Account
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 PetalPay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
