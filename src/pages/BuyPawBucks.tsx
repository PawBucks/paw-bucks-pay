import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { BottomNav } from "@/components/BottomNav";
import { Coins, ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";

const BuyPawBucks = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const packages = [
    { amount: 500, coins: 5000, priceId: "price_1SRaEJK2QqG8Wa5zcYkGxpUu", popular: false },
    { amount: 1000, coins: 10000, priceId: "price_1SRaEzK2QqG8Wa5zuAIfqa3C", popular: true },
    { amount: 2000, coins: 20000, priceId: "price_1SRaGRK2QqG8Wa5zyhNr4yCw", popular: false },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handlePurchase = async (priceId: string, coins: number, amount: number) => {
    if (!user) {
      toast.error("Please sign in to purchase PawBucks");
      navigate("/auth");
      return;
    }

    setLoading(amount.toString());
    try {
      console.log("Invoking create-pawbucks-checkout with:", { priceId, coins });
      
      const { data, error } = await supabase.functions.invoke("create-pawbucks-checkout", {
        body: { priceId, coins },
      });

      console.log("Response from edge function:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      if (data?.url) {
        console.log("Redirecting to Stripe checkout:", data.url);
        // Use window.location.href instead of window.open to avoid popup blockers
        window.location.href = data.url;
      } else {
        console.error("No URL received from checkout session");
        throw new Error("Failed to create checkout session - no URL received");
      }
    } catch (error: any) {
      console.error("Purchase error:", error);
      toast.error(error.message || "Failed to create checkout session");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] pb-24">
      <Header isAuthenticated={!!user} onLogout={handleSignOut} />

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <ShoppingCart className="w-10 h-10 text-primary" />
            <h2 className="text-4xl font-bold">Buy PawBucks</h2>
          </div>
          <p className="text-muted-foreground text-lg">Purchase PawBucks directly and save on every transaction! 🐾</p>
        </div>

        {/* Packages Grid */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {packages.map((pkg) => (
            <GradientCard
              key={pkg.amount}
              gradient={pkg.popular}
              className={`relative ${pkg.popular ? 'border-2 border-primary' : ''}`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}
              
              <div className="text-center space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Coins className="w-8 h-8 text-yellow-500" />
                  </div>
                  <p className="text-4xl font-bold">{pkg.coins.toLocaleString()}</p>
                  <p className="text-muted-foreground">PawBucks</p>
                </div>

                <div className="py-4 border-t border-b border-border/50">
                  <p className="text-3xl font-bold">${pkg.amount}</p>
                  <p className="text-sm text-muted-foreground mt-1">One-time purchase</p>
                </div>

                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Instant delivery</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Never expires</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Use on any purchase</span>
                  </div>
                </div>

                <Button
                  onClick={() => handlePurchase(pkg.priceId, pkg.coins, pkg.amount)}
                  disabled={loading === pkg.amount.toString()}
                  className="w-full"
                  size="lg"
                >
                  {loading === pkg.amount.toString() ? (
                    "Processing..."
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Buy Now
                    </>
                  )}
                </Button>
              </div>
            </GradientCard>
          ))}
        </div>

        {/* Info Section */}
        <GradientCard>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">How it works</h3>
            <div className="space-y-3 text-muted-foreground">
              <p>1. Choose your PawBucks package above</p>
              <p>2. Complete your purchase securely with Stripe</p>
              <p>3. PawBucks are instantly added to your wallet</p>
              <p>4. Use your PawBucks on any purchase throughout the platform!</p>
            </div>
          </div>
        </GradientCard>
      </main>

      <BottomNav />
    </div>
  );
};

export default BuyPawBucks;
