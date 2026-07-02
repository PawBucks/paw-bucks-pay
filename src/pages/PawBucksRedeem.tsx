import { useEffect, useState } from"react";
import { useNavigate, useSearchParams } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useOptimizedQuery } from"@/hooks/useOptimizedQuery";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { BottomNav } from"@/components/BottomNav";
import { DashboardSkeleton } from"@/components/LoadingSkeleton";
import { Check, Copy } from "lucide-react";
import { toast } from"sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from"@/components/ui/dialog";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { Badge } from"@/components/ui/badge";
import { useQuery } from"@tanstack/react-query";

type PartnerOffer = {
 id: string;
 title: string;
 description: string;
 coins_required: number;
 brand_id?: string | null;
 partner_id?: string | null;
 brand?: { id: string; brand_name: string } | null;
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
 const [searchParams] = useSearchParams();
 const [selectedOffer, setSelectedOffer] = useState<PartnerOffer | null>(null);
 const [isRedeeming, setIsRedeeming] = useState(false);
 const [redemptionResult, setRedemptionResult] = useState<RedemptionResult | null>(null);
 const [showConfirmation, setShowConfirmation] = useState(false);

 // Check if user is part of a shared account
 const sharedAccount = useSharedAccount(user?.id);
 const effectiveWalletUserId = getEffectiveWalletUserId(user?.id, sharedAccount);

 const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useOptimizedQuery<PawBucksWallet | null>(
 ['pawbucks-wallet', effectiveWalletUserId ||''],
 async () => {
 if (!effectiveWalletUserId) return null;
 const { data, error } = await supabase
 .from('pawbucks_wallet')
 .select('balance')
 .eq('user_id', effectiveWalletUserId)
 .single();
 
 if (error) throw error;
 return data;
 },
 { staleTime: 1000 * 30, enabled: !sharedAccount.isLoading }
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

  // Auto-open confirmation for offer passed via ?offer=<id>
  useEffect(() => {
    const offerId = searchParams.get('offer');
    if (!offerId || !offers || offers.length === 0 || selectedOffer) return;
    const match = offers.find((o) => o.id === offerId);
    if (match) {
      setSelectedOffer(match);
      // Scroll card into view
      requestAnimationFrame(() => {
        document.getElementById(`offer-${match.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [searchParams, offers, selectedOffer]);

  // Branded PB balances per (brand_id, merchant_id) for the offers shown.
  // The product gate already runs server-side; this hook just powers the
  // "X PB available for this brand" hint on each offer card.
  const brandedKeys = (offers ?? [])
    .filter((o) => !!o.brand_id && !!o.partner_id)
    .map((o) => `${o.partner_id}:${o.brand_id}`);
  const { data: brandedBalances = {} } = useQuery<Record<string, number>>({
    queryKey: ['branded-pb-for-offers', effectiveWalletUserId, brandedKeys.sort().join('|')],
    enabled: !!effectiveWalletUserId && brandedKeys.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branded_pawbucks_ledger')
        .select(
          'balance, campaign_id, brand_campaigns!inner(brand_id, status, brand_campaign_merchants!inner(merchant_id, status))',
        )
        .eq('user_id', effectiveWalletUserId!)
        .gt('balance', 0);
      if (error) throw error;
      const out: Record<string, number> = {};
      for (const row of (data ?? []) as any[]) {
        const c = row.brand_campaigns;
        if (!c || c.status !== 'active') continue;
        for (const m of c.brand_campaign_merchants ?? []) {
          if ((m.status ?? 'active') !== 'active') continue;
          const key = `${m.merchant_id}:${c.brand_id}`;
          out[key] = (out[key] ?? 0) + (Number(row.balance) || 0);
        }
      }
      return out;
    },
    staleTime: 30 * 1000,
  });

  const loading = sharedAccount.isLoading || walletLoading || offersLoading;

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
 <main className="container mx-auto px-4 py-8 max-w-7xl lg:max-w-7xl">
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
 <PawBucksLogo className="w-6 h-6 text-warning" />
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
        const brandedAvail = offer.brand_id && offer.partner_id
          ? brandedBalances[`${offer.partner_id}:${offer.brand_id}`] ?? 0
          : 0;

 return (
             <div key={offer.id} id={`offer-${offer.id}`}>
             <GradientCard className="relative overflow-hidden">
 {!canAfford && (
 <div className="absolute top-2 right-2 bg-destructive/20 text-destructive px-3 py-1 rounded-full text-xs font-semibold">
 Insufficient PawBucks
 </div>
 )}
 
 <div className="flex items-start gap-3 mb-4">
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <span className="w-6 h-6 text-primary" aria-hidden="true">🏪</span>
 </div>
 <div>
 <h3 className="font-semibold text-lg">{offer.merchants?.business_name ||'Partner'}</h3>
 <p className="text-xs text-muted-foreground capitalize">{offer.merchants?.business_type ||'Merchant'}</p>
 </div>
 </div>

 <h4 className="font-bold text-xl mb-2">{offer.title}</h4>
 <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{offer.description}</p>

       {offer.brand && (
         <div className="mb-3 flex flex-wrap items-center gap-2">
           <Badge variant="secondary" className="text-xs">
             {offer.brand.brand_name} branded
           </Badge>
           {brandedAvail > 0 ? (
             <span className="text-xs text-muted-foreground">
               {brandedAvail.toLocaleString()} {offer.brand.brand_name} PB available
             </span>
           ) : (
             <span className="text-xs text-muted-foreground">
               Requires {offer.brand.brand_name}-funded PawBucks
             </span>
           )}
         </div>
       )}

 <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
 <div className="flex items-center gap-1">
 <PawBucksLogo className="w-5 h-5 text-warning" />
 <span className="font-bold text-lg">{offer.coins_required.toLocaleString()}</span>
 <span className="text-sm text-muted-foreground">PawBucks</span>
 </div>
 <Button
 onClick={() => handleRedeemClick(offer)}
 disabled={!canAfford}
 size="sm"
 >
 <span className="w-4 h-4 mr-1" aria-hidden="true">🎁</span>
                        Spend PawBucks
 </Button>
 </div>
 </GradientCard>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-16">
 <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
 <span className="w-10 h-10 text-muted-foreground" aria-hidden="true">🎁</span>
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
          <DialogTitle>Spend PawBucks?</DialogTitle>
 <DialogDescription>
            You're about to spend PawBucks from your balance on this offer. This cannot be undone.
 </DialogDescription>
 </DialogHeader>
 {selectedOffer && (
 <div className="space-y-4">
 <div className="bg-muted p-4 rounded-lg">
 <p className="font-semibold text-lg mb-2">{selectedOffer.title}</p>
 <p className="text-sm text-muted-foreground mb-2">{selectedOffer.merchants?.business_name ||'Partner'}</p>
              <div className="flex items-center justify-between border-t pt-2 mt-2">
                <span className="text-sm text-muted-foreground">Cost</span>
                <div className="flex items-center gap-2 text-warning">
                  <PawBucksLogo className="w-5 h-5" />
                  <span className="font-bold text-xl">-{selectedOffer.coins_required.toLocaleString()} PB</span>
                </div>
              </div>
              {wallet && (
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>New balance after</span>
                  <span>{Math.max(0, wallet.balance - selectedOffer.coins_required).toLocaleString()} PB</span>
                </div>
              )}
 </div>
 <div className="flex gap-3">
 <Button variant="outline" onClick={() => setSelectedOffer(null)} className="flex-1">
 Cancel
 </Button>
 <Button onClick={confirmRedemption} disabled={isRedeeming} className="flex-1">
                {isRedeeming ?"Processing..." :`Spend ${selectedOffer.coins_required.toLocaleString()} PB`}
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
 <Check className="w-6 h-6 text-success" />
 Redemption Successful!
 </DialogTitle>
 </DialogHeader>
 {redemptionResult && (
 <div className="space-y-4">
 <div className="text-center bg-gradient-to-r from-warning/10 to-warning/10 p-6 rounded-lg border-2 border-warning/20">
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
