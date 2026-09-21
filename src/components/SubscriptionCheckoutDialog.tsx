import { useState, useEffect } from"react";
import { useAuth } from"@/hooks/useAuth";
import { merchantSubscriptionsService } from"@/services/api/merchantSubscriptions.service";
import { petsService } from"@/services/api/pets.service";
import { getStripeForConnectedAccount } from"@/lib/stripe";
import { supabase } from"@/integrations/supabase/client";
import { useQuery } from"@tanstack/react-query";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Slider } from"@/components/ui/slider";
import { Loader2, Check, RefreshCw, Info } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { toast } from"sonner";
import { Elements, CardElement, useStripe, useElements } from"@stripe/react-stripe-js";
import { useSpendablePawBucks } from"@/hooks/useSpendablePawBucks";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from"@/components/ui/tooltip";
import { PawBucksInfoTooltip } from"@/components/PawBucksInfoTooltip";
import { PawBucksSourceSelector, type PawBucksSource } from"@/components/checkout/PawBucksSourceSelector";

import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";
// Pet Owner conversion rate: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;
// Minimum Stripe charge for subscriptions
const MINIMUM_STRIPE_AMOUNT = 0.50;
// Minimum transaction for Pet Fund
const PET_FUND_MIN_USD = 30;
// Server-enforced minimum for legacy Welcome Credit redemption ($75).
const WELCOME_CREDIT_MIN_USD = 75;

interface SubscriptionCheckoutDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 plan: {
 id: string;
 name: string;
 description: string | null;
 amount: number;
 currency: string;
 billing_interval: string;
 billing_interval_count: number;
 stripe_price_id: string;
 features: string[];
 trial_days: number;
 };
 merchantId: string;
 merchantName: string;
 connectedAccountId: string;
 merchantAcceptsPawBucks?: boolean;
 cashbackRate?: number;
 onSuccess: () => void;
}

const CheckoutForm = ({
 plan,
 merchantId,
 merchantName,
 merchantAcceptsPawBucks = false,
 cashbackRate = 10,
 onSuccess,
 onClose,
}: {
 plan: SubscriptionCheckoutDialogProps["plan"];
 merchantId: string;
 merchantName: string;
 merchantAcceptsPawBucks: boolean;
 cashbackRate: number;
 onSuccess: () => void;
 onClose: () => void;
}) => {
 const stripe = useStripe();
 const elements = useElements();
 const { user } = useAuth();
 const [isProcessing, setIsProcessing] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [pawbucksToUse, setPawbucksToUse] = useState(0);
 const [pawbucksSource, setPawbucksSource] = useState<PawBucksSource>("none");
 const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

 // Pets on the account — a household with several pets may hold one
 // subscription per pet on the same plan.
 const { data: pets } = useQuery({
  queryKey: ["pet-profiles", user?.id],
  queryFn: async () => {
   const result = await petsService.getByUserId(user!.id);
   if (result.error) throw result.error;
   return result.data;
  },
  enabled: !!user?.id,
  staleTime: 1000 * 60 * 5,
 });

 // Pets that already have this plan — they can't be picked again.
 const { data: subscribedPets } = useQuery({
  queryKey: ["subscribed-pets", merchantId, plan.stripe_price_id, user?.id],
  queryFn: () => merchantSubscriptionsService.getSubscribedPetIds(merchantId, plan.stripe_price_id),
  enabled: !!user?.id,
  staleTime: 0,
 });

 const takenPetIds = subscribedPets?.petIds ?? [];
 // Subscriptions made before the pet picker existed aren't linked to a pet, so
 // they still take up a slot. Count them so nobody is billed twice.
 const unassignedCount = subscribedPets?.unassignedCount ?? 0;
 const availablePets = (pets || []).filter((p: any) => !takenPetIds.includes(p.id));
 const petSelectionRequired = (pets || []).length > 0;
 const allSlotsTaken =
  petSelectionRequired &&
  takenPetIds.length + unassignedCount >= (pets || []).length;

 // Default to the first pet that isn't already subscribed.
 useEffect(() => {
  if (!petSelectionRequired) return;
  if (selectedPetId && !takenPetIds.includes(selectedPetId)) return;
  setSelectedPetId(availablePets[0]?.id ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [petSelectionRequired, availablePets.length]);

 // Use the spendable PawBucks hook to get available balance + welcome credit
 const { 
 spendableBalance, 
 lockedBalance, 
 welcomeCreditBalance,
 hasWelcomeCredit,
 hasPetFund,
 petFundBalance,
 petFundMinTransactionUsd,
  earnedNextExpiresAt,
  earnedNextExpiringAmount,
  earnedNextEarnedAt,
  promotionalNextExpiresAt,
 isLoading: loadingBalance 
 } = useSpendablePawBucks(user?.id);

 // Read user's auto-redeem preference so we honor it on merchant subscriptions.
 const { data: autoRedeemPref } = useQuery({
  queryKey: ["auto-redeem-preference-merchant-sub", user?.id],
  queryFn: async () => {
   if (!user?.id) return { mode:"off", minCoverage: 20, maxApply: 50 };
   const { data } = await supabase
    .from("profiles")
    .select("auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct")
    .eq("id", user.id)
    .single();
   return {
    mode: (data?.auto_redeem_mode as string) ||"off",
    minCoverage: data?.auto_redeem_min_coverage_pct ?? 20,
    maxApply: data?.auto_redeem_max_apply_pct ?? 50,
   };
  },
  staleTime: 1000 * 60 * 5,
  enabled: !!user?.id,
 });
 const autoRedeemEnabled = !!autoRedeemPref && autoRedeemPref.mode !=="off";

 // Reset slider when dialog is mounted
 useEffect(() => {
 setPawbucksToUse(0);
 setPawbucksSource("none");
 }, []);

 const priceAmount = plan.amount / 100; // Convert cents to dollars
 
 const petFundMinUsd = hasPetFund
   ? (petFundMinTransactionUsd || PET_FUND_MIN_USD)
   : WELCOME_CREDIT_MIN_USD;
 const petFundCreditBalance = hasPetFund ? petFundBalance : welcomeCreditBalance;
 const welcomeCreditApplicable = (hasPetFund || hasWelcomeCredit) && merchantAcceptsPawBucks && priceAmount >= petFundMinUsd;
 
 // Both sources available → user must choose one
 const hasBothSources = spendableBalance > 0 && welcomeCreditApplicable && petFundCreditBalance > 0;

 const pawbucksBalance = hasBothSources
 ? (pawbucksSource ==="earned" ? spendableBalance : pawbucksSource ==="promotional" ? petFundCreditBalance : 0)
 : (spendableBalance + (welcomeCreditApplicable ? petFundCreditBalance : 0));

 const handleSourceChange = (source: PawBucksSource) => {
 setPawbucksSource(source);
 setPawbucksToUse(0);
 };

 // Calculate values
 const pawbucksUsdValue = pawbucksToUse * PAWBUCKS_TO_USD;
 
 // For subscriptions, ensure minimum Stripe charge
 const maxPawBucksUsd = priceAmount - MINIMUM_STRIPE_AMOUNT;
 const maxPawBucks = Math.min(
 pawbucksBalance, 
 Math.max(0, Math.floor(maxPawBucksUsd / PAWBUCKS_TO_USD))
 );
 
 const stripeAmount = Math.max(MINIMUM_STRIPE_AMOUNT, priceAmount - pawbucksUsdValue);
 const cashbackPawBucks = stripeAmount > 0 ? Math.round(stripeAmount * cashbackRate) : 0;

  // Pre-fill the slider based on user's auto-redeem preference (one-shot, when balance loads).
  useEffect(() => {
   if (loadingBalance) return;
   if (!autoRedeemEnabled) return;
   if (!merchantAcceptsPawBucks) return;
   if (pawbucksToUse > 0) return; // user already adjusted
   if (maxPawBucks <= 0 || pawbucksBalance <= 0) return;

   const mode = autoRedeemPref!.mode;
   let proposed = 0;
   if (mode ==="always" || mode ==="subscriptions_only") {
    proposed = Math.min(pawbucksBalance, maxPawBucks);
   } else if (mode ==="smart") {
    const availableUsd = pawbucksBalance * PAWBUCKS_TO_USD;
    const coveragePct = (availableUsd / priceAmount) * 100;
    if (coveragePct >= autoRedeemPref!.minCoverage) {
     const maxUsd = priceAmount * (autoRedeemPref!.maxApply / 100);
     proposed = Math.min(
      pawbucksBalance,
      Math.floor(maxUsd / PAWBUCKS_TO_USD),
      maxPawBucks,
     );
    }
   }
   if (proposed > 0) setPawbucksToUse(proposed);
   // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingBalance, autoRedeemEnabled, merchantAcceptsPawBucks, maxPawBucks, pawbucksBalance]);

 const formatInterval = (interval: string, count: number) => {
 const labels: Record<string, [string, string]> = {
 day: ["day","days"],
 week: ["week","weeks"],
 month: ["month","months"],
 year: ["year","years"],
 };
 const [singular, plural] = labels[interval] || ["period","periods"];
 return count === 1 ? `per ${singular}` : `every ${count} ${plural}`;
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!user) {
 setError("You must be logged in to subscribe. Please sign in and try again.");
 return;
 }

  if (!stripe || !elements) {
 setError("Payment system is still loading. Please wait a moment and try again.");
 return;
 }

 if (allSlotsTaken) {
 setError("You already have an active subscription to this plan for every pet on your account.");
 return;
 }

 if (petSelectionRequired && !selectedPetId) {
 setError("Please choose which pet this subscription is for.");
 return;
 }

 const cardElement = elements.getElement(CardElement);
 if (!cardElement) {
 setError("Card input not found.");
 return;
 }

 setIsProcessing(true);
 setError(null);

 try {
 // Create payment method
 const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
 type:"card",
 card: cardElement,
 billing_details: {
 email: user.email,
 },
 });

 if (pmError) {
 setError(pmError.message ||"Failed to process card.");
 setIsProcessing(false);
 return;
 }

 // Call our edge function to create the subscription with PawBucks
  const result = await merchantSubscriptionsService.create({
 merchantId,
 priceId: plan.stripe_price_id,
 productName: plan.name,
 paymentMethodId: paymentMethod.id,
 pawbucksToUse: pawbucksToUse > 0 ? pawbucksToUse : undefined,
    autoRedeem: autoRedeemEnabled,
 petId: selectedPetId ?? undefined,
 });

 if (!result.success) {
 // Handle 3D Secure if needed
 if (result.requiresAction && result.clientSecret) {
 const { error: confirmError } = await stripe.confirmCardPayment(result.clientSecret);
 if (confirmError) {
 setError(confirmError.message ||"Payment confirmation failed.");
 setIsProcessing(false);
 return;
 }
 // If successful after 3DS, show success
 toast.success(`Subscribed to ${plan.name}!`);
 onSuccess();
 onClose();
 return;
 }

 setError(result.error ||"Failed to create subscription.");
 setIsProcessing(false);
 return;
 }

 const pawbucksEarnedMsg = result.pawbucksEarned 
 ? ` You earned ${result.pawbucksEarned} PawBucks!` 
 :"";
 const pawbucksUsedMsg = pawbucksToUse > 0 
 ? ` Used ${pawbucksToUse.toLocaleString()} PawBucks for ${Formatters.currency(pawbucksUsdValue)} discount.` 
 :"";

 toast.success(`Subscribed to ${plan.name}!`, {
 description: `Your subscription with ${merchantName} is now active.${pawbucksUsedMsg}${pawbucksEarnedMsg}`,
 });
 onSuccess();
 onClose();
 } catch (err: any) {
 console.error("Subscription error:", err);
 setError(err.message ||"An unexpected error occurred.");
 } finally {
 setIsProcessing(false);
 }
 };

 // If merchant doesn't accept PawBucks or user has no balance, show simplified version
 const showPawBucksSection = merchantAcceptsPawBucks && pawbucksBalance > 0 && maxPawBucks > 0;

 return (
 <form onSubmit={handleSubmit} className="space-y-6">
 {loadingBalance ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 ) : (
 <>
 {/* Plan Summary */}
 <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="font-semibold">{plan.name}</h3>
 <p className="text-sm text-muted-foreground">{merchantName}</p>
 </div>
 <Badge variant="secondary" className="gap-1">
 <RefreshCw className="h-3 w-3" />
 Recurring
 </Badge>
 </div>
 
 <div className="flex items-baseline gap-1">
 <span className="text-2xl font-bold">{Formatters.currency(priceAmount)}</span>
 <span className="text-muted-foreground">{formatInterval(plan.billing_interval, plan.billing_interval_count)}</span>
 </div>

 {plan.trial_days > 0 && (
 <Badge variant="outline" className="text-success border-success/30">
 {plan.trial_days} day free trial
 </Badge>
 )}

 {plan.features.length > 0 && (
 <ul className="space-y-1 pt-2">
 {plan.features.slice(0, 4).map((feature, i) => (
 <li key={i} className="flex items-center gap-2 text-sm">
 <Check className="h-3 w-3 text-success" />
 {feature}
 </li>
 ))}
 </ul>
 )}
 </div>

 {/* Pet selection — one subscription per pet is allowed */}
 {petSelectionRequired && (
 <div className="space-y-2">
 <p className="text-sm font-medium">Who is this subscription for?</p>
 <div className="grid grid-cols-2 gap-2">
 {(pets || []).map((pet: any) => {
 const taken = takenPetIds.includes(pet.id);
 return (
 <button
 key={pet.id}
 type="button"
 disabled={taken}
 onClick={() => setSelectedPetId(pet.id)}
 className={`rounded-lg border p-3 text-left transition-colors ${
 selectedPetId === pet.id
 ? "border-primary bg-primary/5"
 : "border-border hover:bg-muted/50"
 } ${taken ? "opacity-50 cursor-not-allowed" : ""}`}
 >
 <p className="text-sm font-medium">{pet.name}</p>
 <p className="text-xs text-muted-foreground">
 {taken ? "Already subscribed" : pet.breed || pet.type}
 </p>
 </button>
 );
 })}
 </div>
 {(availablePets.length === 0 || allSlotsTaken) && (
 <p className="text-xs text-muted-foreground">
 All of your pets already have this plan. Add another pet to subscribe again.
 </p>
 )}
 </div>
 )}


 {/* Source Selector - when both earned and promotional are available */}
 {hasBothSources && (
 <PawBucksSourceSelector
 earnedBalance={spendableBalance}
 promotionalBalance={petFundCreditBalance}
 selectedSource={pawbucksSource}
 onSourceChange={handleSourceChange}
 promotionalLabel={hasPetFund ?"Pet Fund Credit" :"Welcome Credit"}
  earnedNextExpiresAt={earnedNextExpiresAt}
  earnedNextExpiringAmount={earnedNextExpiringAmount}
  earnedNextEarnedAt={earnedNextEarnedAt}
  promotionalNextExpiresAt={promotionalNextExpiresAt}
 />
 )}

 {/* Welcome Credit Banner - only when sole source */}
 {welcomeCreditApplicable && !hasBothSources && (
 <div className="bg-success/10 border border-success/20 rounded-lg p-3 flex items-start gap-2">
 <span className="w-4 h-4 text-success mt-0.5 flex-shrink-0" aria-hidden="true">🎁</span>
 <div>
 <p className="text-sm font-medium text-success">
 🎉 Welcome Credit Available: {welcomeCreditBalance.toLocaleString()} PB ({Formatters.currency((welcomeCreditBalance * PAWBUCKS_TO_USD))})
 </p>
 <p className="text-xs text-success/80 mt-0.5">
 Your Welcome Credit is included in your available balance below.
 </p>
 </div>
 </div>
 )}

 {/* Pet Fund not applicable - below minimum */}
 {(hasPetFund || hasWelcomeCredit) && merchantAcceptsPawBucks && priceAmount < petFundMinUsd && (
 <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
 <span className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" aria-hidden="true">🎁</span>
 <div>
 <p className="text-sm font-medium text-warning">
 Pet Fund: {Formatters.currency((petFundCreditBalance * PAWBUCKS_TO_USD))} available
 </p>
 <p className="text-xs text-warning/80 mt-0.5">
 Add {Formatters.currency((petFundMinUsd - priceAmount))} more to unlock your Pet Fund credit.
 </p>
 <div className="mt-2">
 <div className="w-full bg-warning/15 rounded-full h-2">
 <div className="bg-warning h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (priceAmount / petFundMinUsd) * 100)}%` }} />
 </div>
 </div>
 </div>
 </div>
 )}

 {/* PawBucks Section */}
 {showPawBucksSection && (
 <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium flex items-center gap-2">
 <PawBucksLogo className="w-4 h-4 text-primary" />
 Apply PawBucks
 <PawBucksInfoTooltip variant="redemption" />
 </span>
 <span className="text-sm text-muted-foreground">
 Balance: {pawbucksBalance.toLocaleString()} PB
 {pawbucksSource ==="promotional" && (
 <span className="text-success ml-1">(credit)</span>
 )}
 </span>
 </div>

         {autoRedeemEnabled && pawbucksToUse > 0 && (
          <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-2 rounded-md border border-primary/20">
           <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
           <span>
            <span className="font-semibold">Auto-Redeem active</span> — your saved preference applied {pawbucksToUse.toLocaleString()} PB. Adjust the slider to override.
           </span>
          </div>
         )}

 {/* Slider instruction hint */}
 {pawbucksToUse === 0 && (
 <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-2 rounded-md animate-pulse">
 <span className="text-base">👆</span>
 <span className="font-medium">Drag the slider right to apply your PawBucks discount</span>
 </div>
 )}

 <Slider
 value={[pawbucksToUse]}
 onValueChange={([value]) => setPawbucksToUse(value)}
 max={maxPawBucks}
 min={0}
 step={maxPawBucks <= 500 ? 1 : 100}
 className="w-full"
 />

 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">
 {pawbucksToUse === 0 ? (
 <span className="italic">No PawBucks applied</span>
 ) : (
 <>{pawbucksToUse.toLocaleString()} PawBucks</>
 )}
 </span>
 <span className={`font-medium ${pawbucksToUse > 0 ?'text-primary' :'text-muted-foreground'}`}>
 {pawbucksToUse > 0 ? `= ${Formatters.currency(pawbucksUsdValue)} off` :'$0.00 off'}
 </span>
 </div>

 {pawbucksToUse > 0 && (
 <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
 💡 A minimum {Formatters.currency(MINIMUM_STRIPE_AMOUNT)} charge is required for recurring billing. PawBucks discount applies to first payment only.
 </div>
 )}
 </div>
 )}

 {/* Info when merchant accepts PawBucks but user has none */}
 {merchantAcceptsPawBucks && pawbucksBalance === 0 && !hasWelcomeCredit && (
 <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg flex items-start gap-2">
 <PawBucksLogo className="w-4 h-4 mt-0.5 flex-shrink-0" />
 <span>This merchant accepts PawBucks, but you don't have any spendable yet. Earn PawBucks by making purchases!</span>
 </div>
 )}

 {/* Info about locked rewards */}
 {merchantAcceptsPawBucks && lockedBalance > 0 && pawbucksBalance === 0 && (
 <div className="text-sm text-warning bg-warning/10 p-3 rounded-lg flex items-start gap-2 border border-warning/20">
 <span className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true">🔒</span>
 <div>
 <span className="font-medium">You have {lockedBalance.toLocaleString()} PawBucks locked</span>
 <p className="text-xs mt-1 text-warning/80">
 These points are currently locked until your recent vet visit is fully processed.
 </p>
 </div>
 </div>
 )}

 {/* Show locked balance hint when they have some spendable */}
 {merchantAcceptsPawBucks && lockedBalance > 0 && pawbucksBalance > 0 && (
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger asChild>
 <div className="flex items-center gap-1 text-xs text-warning cursor-help">
 <span className="w-3 h-3" aria-hidden="true">🔒</span>
 <span>+{lockedBalance.toLocaleString()} PB locked (vesting)</span>
 <Info className="w-3 h-3" />
 </div>
 </TooltipTrigger>
 <TooltipContent side="top" className="max-w-xs">
 <p>These rewards are from recent vet visits and will unlock once insurance claims are fully processed.</p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 )}

 {/* Payment Summary */}
 <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Price:</span>
 <span>{Formatters.currency(priceAmount)}</span>
 </div>
 
 {pawbucksToUse > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">PawBucks Discount:</span>
 <span className="text-primary font-medium">−{Formatters.currency(pawbucksUsdValue)}</span>
 </div>
 )}

 {pawbucksToUse > 0 && welcomeCreditApplicable && pawbucksToUse > spendableBalance && (
 <div className="flex justify-between text-xs text-success pl-4">
 <span>└ includes Welcome Credit</span>
 <span>{Math.min(pawbucksToUse - spendableBalance, welcomeCreditBalance).toLocaleString()} PB</span>
 </div>
 )}
 
 <div className="flex justify-between text-sm pt-2 border-t">
 <span className="font-medium">Card Payment:</span>
 <span className="font-bold">{Formatters.currency(stripeAmount)}</span>
 </div>
 
 {stripeAmount > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground flex items-center gap-1">
 <Sparkles className="w-3 h-3 text-warning" />
 Cashback ({cashbackRate}x):
 </span>
 <span className="font-bold text-warning">
 +{cashbackPawBucks.toLocaleString()} PawBucks
 </span>
 </div>
 )}
 </div>

 {/* Card Input */}
 <div className="space-y-2">
 <label className="text-sm font-medium">Payment Details</label>
 <div className="rounded-md border p-3 bg-background">
 <CardElement
 options={{
 style: {
 base: {
 fontSize:"16px",
 color:"hsl(var(--foreground))",
"::placeholder": { color:"hsl(var(--muted-foreground))" },
 },
 },
 }}
 />
 </div>
 </div>

 {error && (
 <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
 {error}
 </div>
 )}

 {/* Security Notice */}
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <span className="h-4 w-4 text-success" aria-hidden="true">🛡️</span>
 <span>Secure payment powered by Stripe. Cancel anytime.</span>
 </div>
 </>
 )}

 <DialogFooter>
 <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
 Cancel
 </Button>
 <Button type="submit" disabled={!stripe || !user || isProcessing || loadingBalance || (petSelectionRequired && !selectedPetId)}>
 {isProcessing ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : (
 <>
 <span className="h-4 w-4 mr-2" aria-hidden="true">💳</span>
 {pawbucksToUse > 0 ? `Pay ${Formatters.currency(stripeAmount)}` :"Subscribe"}
 </>
 )}
 </Button>
 </DialogFooter>
 </form>
 );
};

export function SubscriptionCheckoutDialog({
 open,
 onOpenChange,
 plan,
 merchantId,
 merchantName,
 connectedAccountId,
 merchantAcceptsPawBucks = false,
 cashbackRate = 10,
 onSuccess,
}: SubscriptionCheckoutDialogProps) {
 const [stripePromise, setStripePromise] = useState<ReturnType<typeof getStripeForConnectedAccount> | null>(null);

 useEffect(() => {
 if (connectedAccountId && open) {
 setStripePromise(getStripeForConnectedAccount(connectedAccountId));
 }
 }, [connectedAccountId, open]);

 if (!stripePromise) {
 return null;
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Sparkles className="h-5 w-5 text-primary" />
 Subscribe to Plan
 </DialogTitle>
 <DialogDescription>
 Start your recurring subscription with {merchantName}
 </DialogDescription>
 </DialogHeader>

 <Elements stripe={stripePromise}>
 <CheckoutForm
 plan={plan}
 merchantId={merchantId}
 merchantName={merchantName}
 merchantAcceptsPawBucks={merchantAcceptsPawBucks}
 cashbackRate={cashbackRate}
 onSuccess={onSuccess}
 onClose={() => onOpenChange(false)}
 />
 </Elements>
 </DialogContent>
 </Dialog>
 );
}
