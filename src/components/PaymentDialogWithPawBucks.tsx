import { useState, useEffect } from"react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Slider } from"@/components/ui/slider";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { supabase } from"@/integrations/supabase/client";
import { Elements, PaymentElement, useStripe, useElements } from"@stripe/react-stripe-js";
import { toast } from"sonner";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from"@/components/ui/alert";
import { PawBucksInfoTooltip } from"@/components/PawBucksInfoTooltip";
import { useSpendablePawBucks } from"@/hooks/useSpendablePawBucks";
import { useStoreLockedBalanceForMerchant } from"@/hooks/useStoreLockedPawBucks";
import { PawBucksSourceSelector, type PawBucksSource } from"@/components/checkout/PawBucksSourceSelector";
import { getStripeForConnectedAccount } from"@/lib/stripe";
import { TipSelector } from"@/components/checkout/TipSelector";
import { buildAppUrl } from"@/lib/url";
import { useQuery } from"@tanstack/react-query";
import {
  effectivePawBucksCapPct,
  maxPawBucksUsdForSubtotal,
  isPromoActive,
  type MerchantCapFields,
} from"@/lib/pawbucksCap";
import { PawBucksCapBreakdown } from"@/components/checkout/PawBucksCapBreakdown";

import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";
// Pet Owner conversion rate: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;
// Minimum transaction for Pet Fund credits (dynamic, but defaults)
const PET_FUND_INITIAL_MIN_USD = 40;
const PET_FUND_MONTHLY_MIN_USD = 20;
// Server enforces a $75 minimum for legacy Welcome Credit redemption
// (see public.redeem_welcome_credit RPC). Keep UI in sync.
const WELCOME_CREDIT_MIN_USD = 75;

type PaymentFormProps = {
 merchantName: string;
 cashbackRate: number;
 stripeAmount: number;
 pawbucksAmount: number;
 totalAmount: number;
 paymentIntentId: string;
 connectedAccountId: string;
 onSuccess: () => void;
 onCancel: () => void;
};

const StripePaymentForm = ({
 merchantName,
 cashbackRate,
 stripeAmount,
 pawbucksAmount,
 totalAmount,
 paymentIntentId,
 connectedAccountId,
 onSuccess,
 onCancel,
}: PaymentFormProps) => {
 const stripe = useStripe();
 const elements = useElements();
 const [isLoading, setIsLoading] = useState(false);
 const [isReady, setIsReady] = useState(false);
 const [loadError, setLoadError] = useState<string | null>(null);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!stripe || !elements) return;

 setIsLoading(true);

 try {
 const { error, paymentIntent } = await stripe.confirmPayment({
 elements,
 confirmParams: {
 return_url: buildAppUrl("/wallet"),
 },
 redirect:'if_required',
 });

 if (error) throw error;

 // Payment succeeded on Stripe - now call our backend to process rewards/transaction
 console.log('[PAYMENT] Stripe payment confirmed, calling confirm-payment-success...', {
 paymentIntentId,
 connectedAccountId,
 stripePaymentStatus: paymentIntent?.status,
 });
 
 // Retry logic for backend confirmation - critical for transaction recording
 let confirmSuccess = false;
 let confirmData = null;
 let lastError = null;
 
 for (let attempt = 1; attempt <= 3; attempt++) {
 console.log(`[PAYMENT] Backend confirmation attempt ${attempt}/3`);
 
 const { data, error: confirmError } = await supabase.functions.invoke(
'confirm-payment-success',
 {
 body: { paymentIntentId, connectedAccountId },
 }
 );

 if (!confirmError && data?.success) {
 confirmSuccess = true;
 confirmData = data;
 console.log('[PAYMENT] confirm-payment-success succeeded:', data);
 break;
 }
 
 lastError = confirmError;
 console.error(`[PAYMENT] Attempt ${attempt} failed:`, confirmError);
 
 // Wait before retry (exponential backoff)
 if (attempt < 3) {
 await new Promise(resolve => setTimeout(resolve, attempt * 1000));
 }
 }

 if (!confirmSuccess) {
 console.error('[PAYMENT] All backend confirmation attempts failed:', lastError);
 // Payment went through but backend processing failed - still show success but warn
 toast.warning("Payment successful! Rewards may take a moment to appear.", {
 description:"If rewards don't appear within a few minutes, please contact support.",
 duration: 8000,
 });
 } else {
 const cashbackPawBucks = confirmData?.pawbucksEarned || Math.round(stripeAmount * cashbackRate);
 toast.success(
 `Payment successful! You earned ${cashbackPawBucks} PawBucks!`
 );
 }

 onSuccess();
 } catch (error: any) {
 console.error("Payment error:", error);
 toast.error(error.message ||"Payment failed");
 } finally {
 setIsLoading(false);
 }
 };

 // Points earned as PawBucks directly (10x of dollar amount = that many PawBucks)
 const cashbackPawBucks = Math.round(stripeAmount * cashbackRate);

 // Show loading overlay until PaymentElement is ready
 const showLoadingOverlay = !isReady && !loadError;

 if (loadError) {
 return (
 <div className="flex flex-col items-center justify-center py-8 space-y-4">
 <AlertCircle className="w-8 h-8 text-destructive" />
 <p className="text-center text-destructive">{loadError}</p>
 <Button variant="outline" onClick={onCancel}>Go Back</Button>
 </div>
 );
 }

 return (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Total Amount:</span>
 <span className="font-medium">{Formatters.currency(totalAmount)}</span>
 </div>
 {pawbucksAmount > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground flex items-center gap-1">
 <PawBucksLogo className="w-3 h-3" /> PawBucks Used:
 </span>
 <span className="font-medium text-primary">
 {pawbucksAmount} (−{Formatters.currency((pawbucksAmount * PAWBUCKS_TO_USD))})
 </span>
 </div>
 )}
 <div className="flex justify-between text-sm border-t pt-2">
 <span className="text-muted-foreground">Pay with Card:</span>
 <span className="font-bold">{Formatters.currency(stripeAmount)}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Points Earned ({cashbackRate}x):</span>
 <span className="font-bold text-accent">+{cashbackPawBucks} PawBucks</span>
 </div>
 </div>

 <div className="space-y-2">
 <Label className="flex items-center gap-2">
 <span className="w-4 h-4" aria-hidden="true">💳</span>
 Payment Details
 </Label>
 <div className="min-h-[200px] relative">
 {showLoadingOverlay && (
 <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10 rounded-md">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 <p className="text-sm text-muted-foreground mt-2">Loading payment form...</p>
 </div>
 )}
 <PaymentElement 
 onReady={() => setIsReady(true)} 
 onLoadError={(error) => setLoadError(error.error.message)}
 />
 </div>
 </div>

 <div className="flex gap-3">
 <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isLoading}>
 Cancel
 </Button>
 <Button type="submit" className="flex-1" disabled={isLoading || !stripe || !isReady}>
 {isLoading ? (
 <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
 ) : !isReady ? (
 <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
 ) : (
 `Pay ${Formatters.currency(stripeAmount)}`
 )}
 </Button>
 </div>
 </form>
 );
};

type PaymentDialogWithPawBucksProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 merchantId: string;
 merchantName: string;
 cashbackRate: number;
 acceptsPawbucks: boolean;
 userId: string;
 onSuccess: () => void;
};

export const PaymentDialogWithPawBucks = ({
 open,
 onOpenChange,
 merchantId,
 merchantName,
 cashbackRate,
 acceptsPawbucks,
 userId,
 onSuccess,
}: PaymentDialogWithPawBucksProps) => {
 const [amount, setAmount] = useState("");
 const [description, setDescription] = useState("");
 const [tipAmount, setTipAmount] = useState(0);
 const [pawbucksToUse, setPawbucksToUse] = useState(0);
 const [pawbucksSource, setPawbucksSource] = useState<PawBucksSource>("none");
 const [autoSelected, setAutoSelected] = useState(false);
 const [clientSecret, setClientSecret] = useState("");
 const [connectedAccountId, setConnectedAccountId] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const [showPaymentForm, setShowPaymentForm] = useState(false);
 const [paymentData, setPaymentData] = useState<any>(null);
 const [redemptionError, setRedemptionError] = useState<{ title: string; message: string } | null>(null);

 // Use the spendable PawBucks hook which includes Pet Fund
 const {
 spendableBalance,
 welcomeCreditBalance,
 hasWelcomeCredit,
 hasPetFund,
 petFundBalance,
 petFundMinTransactionUsd,
 earnedNextExpiresAt,
 promotionalNextExpiresAt,
 isLoading: loadingBalance,
 } = useSpendablePawBucks(userId);

  // Store-locked PB this user has at THIS merchant (Store Rewards Pro)
  const { data: storeLockedBalance = 0 } = useStoreLockedBalanceForMerchant(userId, merchantId);

 // Auto-redeem preference
 const { data: autoRedeemPref } = useQuery({
 queryKey: ["auto-redeem-preference", userId],
 queryFn: async () => {
 const { data } = await supabase.from('profiles').select('auto_redeem_mode').eq('id', userId).single();
 const mode = data?.auto_redeem_mode ||'off';
 return { enabled: mode !=='off', mode };
 },
 staleTime: 1000 * 60 * 5,
 enabled: !!userId,
 });

  // Merchant PawBucks acceptance cap (null when feature is off)
  const { data: merchantCap } = useQuery<MerchantCapFields | null>({
    queryKey: ["merchant-pawbucks-cap", merchantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("merchants_public")
        .select(
          "business_type, pawbucks_cap_enabled, pawbucks_cap_pct, pawbucks_promo_cap_pct, pawbucks_promo_starts_at, pawbucks_promo_ends_at"
        )
        .eq("id", merchantId)
        .maybeSingle();
      return (data as MerchantCapFields) ?? null;
    },
    staleTime: 1000 * 60,
    enabled: !!merchantId && open,
  });

  const capPct = merchantCap ? effectivePawBucksCapPct(merchantCap) : null;
  const promoActive = merchantCap ? isPromoActive(merchantCap) : false;

 const totalAmount = parseFloat(amount) || 0;

 // Pet Fund uses dynamic min; Welcome Credit uses fixed $75 min (server-enforced).
 const petFundMinUsd = hasPetFund
   ? (petFundMinTransactionUsd || PET_FUND_MONTHLY_MIN_USD)
   : WELCOME_CREDIT_MIN_USD;
 const petFundApplicable = (hasPetFund || hasWelcomeCredit) && acceptsPawbucks && totalAmount >= petFundMinUsd;
 const petFundCreditBalance = hasPetFund ? petFundBalance : welcomeCreditBalance;

 // For backwards compat, keep these names
 const welcomeCreditApplicable = petFundApplicable;

 // Both sources available → user must choose one
 const hasBothSources = spendableBalance > 0 && petFundApplicable && petFundCreditBalance > 0;

 // Determine effective balance based on selected source
 const pawbucksBalance = hasBothSources
 ? (pawbucksSource ==="earned" ? spendableBalance : pawbucksSource ==="promotional" ? petFundCreditBalance : 0)
 : (spendableBalance + (petFundApplicable ? petFundCreditBalance : 0));

 const handleSourceChange = (source: PawBucksSource) => {
 setPawbucksSource(source);
 setPawbucksToUse(0);
 setAutoSelected(false);
 };

  // Auto-select best source once balances + amount are known.
  // Prefer promotional (expires in 30 days — sooner than earned at 60 days); otherwise fall back to earned.
  useEffect(() => {
  if (!open || loadingBalance) return;
  if (pawbucksSource !=="none") return;
  if (totalAmount <= 0) return;
  if (petFundApplicable && petFundCreditBalance > 0) {
  setPawbucksSource("promotional");
  setAutoSelected(true);
  } else if (spendableBalance > 0) {
  setPawbucksSource("earned");
  setAutoSelected(true);
  }
  }, [open, loadingBalance, pawbucksSource, totalAmount, spendableBalance, petFundApplicable, petFundCreditBalance]);

 const pawbucksUsdValue = pawbucksToUse * PAWBUCKS_TO_USD;
 // PawBucks only apply to the base amount; tip always goes to card
 const stripeAmount = Math.max(0, totalAmount - pawbucksUsdValue) + tipAmount;
  // Clamp to the merchant's PawBucks acceptance cap (if enabled)
  const capUsdMax = merchantCap
    ? maxPawBucksUsdForSubtotal(totalAmount, merchantCap)
    : totalAmount;
  const maxPawbucks = Math.min(
    pawbucksBalance,
    Math.floor(capUsdMax / PAWBUCKS_TO_USD)
  );

  // If the cap tightens below current selection, gently clamp the slider
  useEffect(() => {
    if (pawbucksToUse > maxPawbucks) {
      setPawbucksToUse(Math.max(0, maxPawbucks));
    }
  }, [maxPawbucks, pawbucksToUse]);

 // Default slider to MAX apply once a source is active and an amount is entered.
 // Auto-fills only when the user hasn't set it (pawbucksToUse === 0).
 useEffect(() => {
 if (!open || loadingBalance) return;
 if (totalAmount <= 0) return;
 if (pawbucksSource ==="none") return;
 if (pawbucksToUse === 0 && maxPawbucks > 0) {
 setPawbucksToUse(maxPawbucks);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [open, loadingBalance, totalAmount, pawbucksSource, maxPawbucks]);

 // Clear redemption error when user adjusts inputs
 useEffect(() => {
   if (redemptionError) setRedemptionError(null);
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [amount, pawbucksToUse, pawbucksSource, tipAmount]);

 // Proactive (client-side) wallet redemption validation
 const MIN_STRIPE_USD = 0.50;
 const cardPortion = stripeAmount; // includes tip
 const cardPortionBelowMin = pawbucksToUse > 0 && cardPortion > 0 && cardPortion < MIN_STRIPE_USD;
 const exceedsBalance = pawbucksToUse > pawbucksBalance;
 const exceedsCap = capPct != null && pawbucksUsdValue > capUsdMax + 0.001;
 const promoBelowMin =
   pawbucksSource ==="promotional" &&
   pawbucksToUse > 0 &&
   totalAmount > 0 &&
   totalAmount < petFundMinUsd;

 const liveWarning: { title: string; message: string } | null = exceedsBalance
   ? {
       title:"Insufficient PawBucks balance",
       message: `You're trying to redeem ${pawbucksToUse.toLocaleString()} PB but only have ${pawbucksBalance.toLocaleString()} PB available. Lower the slider to continue.`,
     }
   : promoBelowMin
   ? {
       title:"Below minimum for credit redemption",
       message: `${hasPetFund ?"Pet Fund" :"Welcome"} credit requires a purchase of at least ${Formatters.currency(petFundMinUsd)}. Add ${Formatters.currency((petFundMinUsd - totalAmount))} more or switch to earned PawBucks.`,
     }
   : exceedsCap
   ? {
       title:"Above merchant's PawBucks cap",
       message: `${merchantName} caps PawBucks at ${Formatters.currency(capUsdMax)} of this purchase. Reduce the slider to stay within the cap.`,
     }
   : cardPortionBelowMin
   ? {
       title:"Card portion too small",
       message: `The remaining card amount is ${Formatters.currency(cardPortion)}, but the minimum card charge is $0.50. Use fewer PawBucks, or use enough to cover the full purchase.`,
     }
   : null;

 const activeError = redemptionError || liveWarning;

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setRedemptionError(null);
 if (totalAmount < 0.50 && pawbucksToUse <= 0) {
 toast.error("Minimum payment amount is $0.50");
 return;
 }
 if (totalAmount <= 0) {
 toast.error("Please enter a valid amount");
 return;
 }
 // Block submission when there's a live wallet redemption issue
 if (liveWarning) {
   setRedemptionError(liveWarning);
   return;
 }

 setIsLoading(true);

 try {
 const { data, error } = await supabase.functions.invoke('create-combined-payment', {
 body: {
 totalAmount: totalAmount + tipAmount, // Total including tip
 pawbucksAmount: pawbucksToUse,
  storeLockedPawbucks: 0, // Reserved for future split UI; auto-applied below if balance exists
 tipAmount,
 merchantId,
 description: description || `Payment to ${merchantName}`,
 autoRedeem: autoRedeemPref?.enabled ?? false,
 },
 });

 if (error) {
 // Extract the actual error message from the edge function response
 const errorBody = typeof error ==='object' && error?.context?.body ? error.context.body : null;
 if (errorBody) {
 try {
 const parsed = typeof errorBody ==='string' ? JSON.parse(errorBody) : errorBody;
 if (parsed?.error) throw new Error(parsed.error);
 } catch (parseErr) {
 // If parsing fails, fall through to generic error
 }
 }
 throw new Error(error.message ||"Payment failed. Please try again.");
 }
 if (data?.error) throw new Error(data.error);

 setPaymentData(data);

 // Full PawBucks payment - no Stripe needed
 if (data.paymentMethod ==='pawbucks_only') {
 toast.success(`Payment of ${Formatters.currency(totalAmount)} completed using ${pawbucksToUse} PawBucks!`);
 handleSuccess();
 return;
 }

 // Stripe payment required - store both clientSecret and connectedAccountId
 setClientSecret(data.clientSecret);
 setConnectedAccountId(data.connectedAccountId);
 setShowPaymentForm(true);
 } catch (error: any) {
 console.error("Payment error:", error);
 const raw = (error?.message ||"Failed to initialize payment").toString();
 const lower = raw.toLowerCase();
 let banner: { title: string; message: string };
 if (lower.includes("insufficient") && (lower.includes("pawbuck") || lower.includes("balance"))) {
   banner = { title:"Insufficient PawBucks balance", message: raw };
 } else if (lower.includes("minimum") || lower.includes("at least") || lower.includes("min ")) {
   banner = { title:"Minimum amount not met", message: raw };
 } else if (lower.includes("cap") || lower.includes("limit") || lower.includes("exceeds")) {
   banner = { title:"Redemption limit reached", message: raw };
 } else if (lower.includes("expired") || lower.includes("expire")) {
   banner = { title:"PawBucks expired", message: raw };
 } else if (lower.includes("welcome credit")) {
   banner = { title:"Welcome credit unavailable", message: raw };
 } else if (lower.includes("pet fund")) {
   banner = { title:"Pet Fund unavailable", message: raw };
 } else if (lower.includes("not accept") || lower.includes("accepts_pawbucks")) {
   banner = { title:"Merchant doesn't accept PawBucks", message: raw };
 } else {
   banner = { title:"Payment couldn't be processed", message: raw };
 }
 setRedemptionError(banner);
 toast.error(banner.title);
 } finally {
 setIsLoading(false);
 }
 };

 const handleSuccess = () => {
 setAmount("");
 setDescription("");
 setTipAmount(0);
 setPawbucksToUse(0);
 setPawbucksSource("none");
 setClientSecret("");
 setConnectedAccountId("");
 setShowPaymentForm(false);
 setPaymentData(null);
 onOpenChange(false);
 onSuccess();
 };

 const handleCancel = () => {
 setAmount("");
 setDescription("");
 setTipAmount(0);
 setPawbucksToUse(0);
 setPawbucksSource("none");
 setClientSecret("");
 setConnectedAccountId("");
 setShowPaymentForm(false);
 setPaymentData(null);
 onOpenChange(false);
 };

 // Points earned as PawBucks (10x of dollar amount = that many PawBucks)
 const cashbackPawBucks = stripeAmount > 0 ? Math.round(stripeAmount * cashbackRate) : 0;

 return (
 <Dialog open={open} onOpenChange={(isOpen) => {
 if (!isOpen) handleCancel();
 else onOpenChange(isOpen);
 }}>
 <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Pay {merchantName}</DialogTitle>
 <DialogDescription className="flex items-center gap-1">
 Earn {cashbackRate}x points in PawBucks on card payments
 <PawBucksInfoTooltip variant="earning" />
 </DialogDescription>
 </DialogHeader>

 {!showPaymentForm ? (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="amount">Amount ($)</Label>
 <Input
 id="amount"
 type="number"
 step="0.01"
 min="0.01"
 placeholder="0.00"
 value={amount}
 onChange={(e) => {
 setAmount(e.target.value);
 // Reset to 0 so the default-to-max effect re-fills against the new amount.
 setPawbucksToUse(0);
 }}
 required
 autoFocus
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="description">Description (optional)</Label>
 <Input
 id="description"
 placeholder="Pet grooming, food, etc."
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 />
 </div>

 {/* Tip Selector - Tips are always in USD, never PawBucks */}
 {totalAmount > 0 && (
 <TipSelector
 baseAmount={totalAmount}
 tipAmount={tipAmount}
 onTipChange={setTipAmount}
 />
 )}

 {/* Source Selector - when both earned and promotional are available */}
 {hasBothSources && totalAmount > 0 && (
 <>
 <PawBucksSourceSelector
 earnedBalance={spendableBalance}
 promotionalBalance={petFundCreditBalance}
 selectedSource={pawbucksSource}
 onSourceChange={handleSourceChange}
 promotionalLabel={hasPetFund ?"Pet Fund Credit" :"Welcome Credit"}
  earnedNextExpiresAt={earnedNextExpiresAt}
  promotionalNextExpiresAt={promotionalNextExpiresAt}
 />
  {autoSelected && pawbucksSource !=="none" && (
  <div className="text-xs bg-primary/5 border border-primary/20 rounded-md px-3 py-2 text-muted-foreground">
  <span className="font-medium text-primary">Auto-selected:</span>{" "}
  {pawbucksSource ==="promotional"
  ? `${hasPetFund ?"Pet Fund" :"Welcome"} credit — these expire 30 days after release, so we apply them first.`
  : "Earned PawBucks — used because you have no promotional credits available."}
  {" "}You can switch sources above.
  </div>
  )}
 </>
 )}

 {/* Pet Fund Credit Banner - only when sole source */}
 {petFundApplicable && !hasBothSources && totalAmount > 0 && (
 <div className="bg-success/10 border border-success/20 rounded-lg p-3 flex items-start gap-2">
 <span className="w-4 h-4 text-success mt-0.5 flex-shrink-0" aria-hidden="true">🎁</span>
 <div>
 <p className="text-sm font-medium text-success">
 🎉 Pet Fund Credit Available: {petFundCreditBalance.toLocaleString()} PB ({Formatters.currency((petFundCreditBalance * PAWBUCKS_TO_USD))})
 </p>
 <p className="text-xs text-success/80 mt-0.5">
 Your Pet Fund credit is included in your balance below. Use the slider to apply it!
 </p>
 </div>
 </div>
 )}

 {/* Pet Fund not applicable - below minimum */}
 {(hasPetFund || hasWelcomeCredit) && acceptsPawbucks && totalAmount > 0 && totalAmount < petFundMinUsd && (
 <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
 <span className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" aria-hidden="true">🎁</span>
 <div>
 <p className="text-sm font-medium text-warning">
 Pet Fund: {Formatters.currency((petFundCreditBalance * PAWBUCKS_TO_USD))} available
 </p>
 <p className="text-xs text-warning/80 mt-0.5">
 Add {Formatters.currency((petFundMinUsd - totalAmount))} more to unlock your Pet Fund credit.
 </p>
 {/* Progress bar */}
 <div className="mt-2">
 <div className="w-full bg-warning/15 rounded-full h-2">
 <div
 className="bg-warning h-2 rounded-full transition-all"
 style={{ width: `${Math.min(100, (totalAmount / petFundMinUsd) * 100)}%` }}
 />
 </div>
 <p className="text-xs mt-1 text-warning/70">
 {Formatters.currency(totalAmount)} / {Formatters.currency(petFundMinUsd)} minimum
 </p>
 </div>
 </div>
 </div>
 )}

 {/* PawBucks Section */}
 {acceptsPawbucks && totalAmount > 0 && pawbucksBalance > 0 && (
 <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
 <div className="flex items-center justify-between">
 <Label className="flex items-center gap-2">
 <PawBucksLogo className="w-4 h-4 text-primary" />
 Use PawBucks
 </Label>
 <span className="text-sm text-muted-foreground">
 Balance: {pawbucksBalance.toLocaleString()} PB
 {pawbucksSource ==="promotional" && (
 <span className="text-success ml-1">(credit)</span>
 )}
 </span>
 </div>

              {capPct != null && (
                <PawBucksCapBreakdown
                  merchantCap={merchantCap}
                  subtotalUsd={totalAmount}
                  merchantName={merchantName}
                />
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
 max={maxPawbucks}
 min={0}
 step={maxPawbucks <= 500 ? 1 : 100}
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

 {pawbucksToUse > 0 && stripeAmount <= 0 && (
 <div className="flex items-center gap-2 text-sm text-accent">
 <Check className="w-4 h-4" />
 Entire purchase covered by PawBucks!
 </div>
 )}
 </div>
 )}

 {acceptsPawbucks && pawbucksBalance === 0 && totalAmount > 0 && !hasWelcomeCredit && (
 <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
 <PawBucksLogo className="w-4 h-4 inline mr-1" />
 This merchant accepts PawBucks, but you don't have any yet. Earn PawBucks by making purchases!
 </div>
 )}

 {/* Payment Summary */}
 {totalAmount > 0 && (
 <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Subtotal:</span>
 <span className="font-medium">{Formatters.currency(totalAmount)}</span>
 </div>
 {tipAmount > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Tip (USD):</span>
 <span className="font-medium">{Formatters.currency(tipAmount)}</span>
 </div>
 )}
 {pawbucksToUse > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">PawBucks:</span>
 <span className="text-primary">−{Formatters.currency(pawbucksUsdValue)}</span>
 </div>
 )}
 {stripeAmount > 0 && (
 <>
 <div className="flex justify-between text-sm border-t pt-2">
 <span className="text-muted-foreground">Card Payment:</span>
 <span className="font-bold">{Formatters.currency(stripeAmount)}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Points Earned ({cashbackRate}x):</span>
 <span className="font-bold text-accent">+{cashbackPawBucks} PawBucks</span>
 </div>
 </>
 )}
 {stripeAmount <= 0 && pawbucksToUse > 0 && tipAmount <= 0 && (
 <div className="text-sm text-center text-accent font-medium pt-2 border-t">
 No card payment needed!
 </div>
 )}
 </div>
 )}

 {/* Wallet redemption error banner */}
 {activeError && (
   <Alert variant="destructive" role="alert" aria-live="polite">
     <AlertCircle className="h-4 w-4" />
     <AlertTitle>{activeError.title}</AlertTitle>
     <AlertDescription>{activeError.message}</AlertDescription>
   </Alert>
 )}

 <div className="flex gap-3">
 <Button type="button" variant="outline" onClick={handleCancel} className="flex-1" disabled={isLoading}>
 Cancel
 </Button>
 <Button type="submit" className="flex-1" disabled={isLoading || !!liveWarning}>
 {isLoading ? (
 <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
 ) : stripeAmount <= 0 && pawbucksToUse > 0 ? (
 `Pay with PawBucks`
 ) : (
"Proceed to Payment"
 )}
 </Button>
 </div>
 </form>
 ) : !connectedAccountId ? (
 // Missing connected account error
 <div className="flex flex-col items-center justify-center py-8 space-y-4">
 <AlertCircle className="w-8 h-8 text-destructive" />
 <p className="text-center text-destructive">Payment system is not configured. Please contact support.</p>
 <Button variant="outline" onClick={handleCancel}>Go Back</Button>
 </div>
 ) : !clientSecret ? (
 // Loading state while waiting for client secret
 <div className="flex flex-col items-center justify-center py-8 space-y-4">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 <p className="text-muted-foreground">Preparing secure payment...</p>
 </div>
 ) : (
 <Elements 
 stripe={getStripeForConnectedAccount(connectedAccountId)} 
 options={{ clientSecret }}
 key={`${connectedAccountId}-${clientSecret}`}
 >
 <StripePaymentForm
 merchantName={merchantName}
 cashbackRate={paymentData?.cashbackRate || cashbackRate}
 stripeAmount={paymentData?.stripeAmount || stripeAmount}
 pawbucksAmount={paymentData?.pawbucksAmount || pawbucksToUse}
 totalAmount={totalAmount}
 paymentIntentId={paymentData?.paymentIntentId ||''}
 connectedAccountId={connectedAccountId}
 onSuccess={handleSuccess}
 onCancel={handleCancel}
 />
 </Elements>
 )}
 </DialogContent>
 </Dialog>
 );
};