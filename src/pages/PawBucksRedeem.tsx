import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { BottomNav } from "@/components/BottomNav";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { Coins, Gift, Store, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type PartnerOffer = {
  id: string;
  title: string;
  description: string;
  coins_required: number;
  merchants: {
    business_name: string;
    business_type: string;
  } | null;
};

type PawBucksWallet = {
  balance: number;
};

type RedemptionResult = {
  code: string;
  partner_name: string;
  offer_title: string;
  coins_spent: number;
  new_balance: number;
};

const PawBucksRedeem = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedOffer, setSelectedOffer] = useState<PartnerOffer | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redemptionResult, setRedemptionResult] = useState<RedemptionResult | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useOptimizedQuery<PawBucksWallet | null>(
    ['pawbucks-wallet', user?.id || ''],
    async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    { staleTime: 1000 * 30 }
  );

  const { data: offers = [], isLoading: offersLoading } = useOptimizedQuery<PartnerOffer[]>(
    ['partner-offers'],
    async () => {
      const { data, error } = await supabase.functions.invoke('get-partner-offers');
      
      if (error) throw error;
      return data.offers || [];
    },
    { staleTime: 1000 * 60 * 5 }
  );

  const loading = walletLoading || offersLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleRedeemClick = (offer: PartnerOffer) => {
    if (!wallet || wallet.balance < offer.coins_required) {
      toast.error("Insufficient PawBucks", {
        description: `You need ${offer.coins_required.toLocaleString()} PawBucks but only have ${wallet?.balance.toLocaleString() || 0}.`,
      });
      return;
    }
    setSelectedOffer(offer);
  };

  const confirmRedemption = async () => {
    if (!selectedOffer) return;

    setIsRedeeming(true);
    try {
      const { data, error } = await supabase.functions.invoke('redeem-pawbucks', {
        body: { offer_id: selectedOffer.id }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setRedemptionResult(data);
      setShowConfirmation(true);
      await refetchWallet();
      
      toast.success("Redemption successful! 🎉");
    } catch (error) {
      console.error("Redemption error:", error);
      toast.error("Failed to redeem offer");
    } finally {
      setIsRedeeming(false);
      setSelectedOffer(null);
    }
  };

  const copyCode = () => {
    if (redemptionResult?.code) {
      navigator.clipboard.writeText(redemptionResult.code);
      toast.success("Code copied to clipboard!");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-hero)] pb-24">
        <Header isAuthenticated={true} onLogout={handleSignOut} />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] pb-24">
      <Header isAuthenticated={true} onLogout={handleSignOut} />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Redeem Your PawBucks</h2>
              <p className="text-muted-foreground">Use your PawBucks for products and services from our partners.</p>
            </div>
            <GradientCard className="px-6 py-4">
              <div className="flex items-center gap-2">
                <Coins className="w-6 h-6 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Your Balance</p>
                  <p className="text-2xl font-bold">{wallet?.balance.toLocaleString() || 0}</p>
                </div>
              </div>
            </GradientCard>
          </div>
        </div>

        {/* Partner Offers Grid */}
        {offers.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => {
              const canAfford = wallet && wallet.balance >= offer.coins_required;
              
              return (
                <GradientCard key={offer.id} className="relative overflow-hidden">
                  {!canAfford && (
                    <div className="absolute top-2 right-2 bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-xs font-semibold">
                      Insufficient PawBucks
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Store className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{offer.merchants?.business_name || 'Partner'}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{offer.merchants?.business_type || 'Merchant'}</p>
                    </div>
                  </div>

                  <h4 className="font-bold text-xl mb-2">{offer.title}</h4>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{offer.description}</p>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-1">
                      <Coins className="w-5 h-5 text-yellow-500" />
                      <span className="font-bold text-lg">{offer.coins_required.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">PawBucks</span>
                    </div>
                    <Button
                      onClick={() => handleRedeemClick(offer)}
                      disabled={!canAfford}
                      size="sm"
                    >
                      <Gift className="w-4 h-4 mr-1" />
                      Redeem
                    </Button>
                  </div>
                </GradientCard>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Offers Available Yet</h3>
            <p className="text-muted-foreground mb-4">Check back soon for exciting redemption offers!</p>
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Redemption</DialogTitle>
            <DialogDescription>
              Are you sure you want to redeem this offer?
            </DialogDescription>
          </DialogHeader>
          {selectedOffer && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold text-lg mb-2">{selectedOffer.title}</p>
                <p className="text-sm text-muted-foreground mb-2">{selectedOffer.merchants?.business_name || 'Partner'}</p>
                <div className="flex items-center gap-2 text-yellow-500">
                  <Coins className="w-5 h-5" />
                  <span className="font-bold text-xl">{selectedOffer.coins_required.toLocaleString()} PawBucks</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setSelectedOffer(null)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={confirmRedemption} disabled={isRedeeming} className="flex-1">
                  {isRedeeming ? "Processing..." : "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-6 h-6 text-green-500" />
              Redemption Successful!
            </DialogTitle>
          </DialogHeader>
          {redemptionResult && (
            <div className="space-y-4">
              <div className="text-center bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-6 rounded-lg border-2 border-yellow-500/20">
                <p className="text-sm text-muted-foreground mb-2">Your Redemption Code</p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <p className="text-3xl font-bold font-mono tracking-wider">{redemptionResult.code}</p>
                  <Button variant="ghost" size="icon" onClick={copyCode}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Show this code at {redemptionResult.partner_name}</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Offer:</span>
                  <span className="font-semibold">{redemptionResult.offer_title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PawBucks Spent:</span>
                  <span className="font-semibold">{redemptionResult.coins_spent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New Balance:</span>
                  <span className="font-semibold">{redemptionResult.new_balance.toLocaleString()} PawBucks</span>
                </div>
              </div>

              <Button onClick={() => setShowConfirmation(false)} className="w-full">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default PawBucksRedeem;
