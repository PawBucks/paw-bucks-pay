import { useState, useEffect } from"react";
import { Button } from"@/components/ui/button";
import { Slider } from"@/components/ui/slider";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { toast } from"sonner";
import { Loader2, Coins, Check, Sparkles, CreditCard, Lock, Info, Gift } from"lucide-react";
import { PawBucksInfoTooltip } from"@/components/PawBucksInfoTooltip";
import { useSpendablePawBucks } from"@/hooks/useSpendablePawBucks";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from"@/components/ui/tooltip";
import { PawBucksSourceSelector, type PawBucksSource } from"@/components/checkout/PawBucksSourceSelector";
import {
  effectivePawBucksCapPct,
  maxPawBucksUsdForSubtotal,
  isPromoActive,
  type MerchantCapFields,
} from"@/lib/pawbucksCap";
import { PawBucksCapBreakdown } from"@/components/checkout/PawBucksCapBreakdown";

import { Formatters } from "@/utils/formatters";
// Pet Owner conversion rate: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;
// Minimum Stripe charge for subscriptions
const MINIMUM_STRIPE_AMOUNT = 0.50;
// Minimum transaction for Pet Fund credits
const PET_FUND_MIN_USD = 20;

type PawBucksCheckoutDialogProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 productName: string;
 priceAmount: number; // in dollars
 isRecurring: boolean;
 merchantName: string;
 merchantAcceptsPawBucks: boolean;
 cashbackRate: number;
 userId: string;
 onProceed: (pawbucksToUse: number) => void;
 isLoading?: boolean;
  /** Optional merchant cap fields (from `merchants_public`). When provided,
   *  the slider is clamped to the merchant's effective PawBucks acceptance cap. */
  merchantCap?: MerchantCapFields | null;
};

export const PawBucksCheckoutDialog = ({
 open,
 onOpenChange,
 productName,
 priceAmount,
 isRecurring,
 merchantName,
 merchantAcceptsPawBucks,
 cashbackRate,
 userId,
 onProceed,
 isLoading = false,
  merchantCap,
}: PawBucksCheckoutDialogProps) => {
 const [pawbucksToUse, setPawbucksToUse] = useState(0);
 const [pawbucksSource, setPawbucksSource] = useState<PawBucksSource>("none");
 const [autoSelected, setAutoSelected] = useState(false);

 // Use the spendable PawBucks hook to get available balance + welcome credit
 const { 
 spendableBalance, 
 lockedBalance, 
 welcomeCreditBalance,
 hasWelcomeCredit,
 hasPetFund,
 petFundBalance,
 petFundMinTransactionUsd,
 isLoading: loadingBalance 
 } = useSpendablePawBucks(userId);

 // Reset slider when dialog closes
 useEffect(() => {
 if (!open) {
 setPawbucksToUse(0);
 setPawbucksSource("none");
 setAutoSelected(false);
 }
 }, [open]);

 const petFundMinUsd = petFundMinTransactionUsd || PET_FUND_MIN_USD;
 const petFundCreditBalance = hasPetFund ? petFundBalance : welcomeCreditBalance;
 const welcomeCreditApplicable = (hasPetFund || hasWelcomeCredit) && merchantAcceptsPawBucks && priceAmount >= petFundMinUsd;
 
 // Both sources available → user must choose one
 const hasBothSources = spendableBalance > 0 && welcomeCreditApplicable && petFundCreditBalance > 0;

 // Determine effective balance based on selected source
 const pawbucksBalance = hasBothSources
 ? (pawbucksSource ==="earned" ? spendableBalance : pawbucksSource ==="promotional" ? petFundCreditBalance : 0)
 : (spendableBalance + (welcomeCreditApplicable ? petFundCreditBalance : 0));

 // Reset slider when source changes
 const handleSourceChange = (source: PawBucksSource) => {
 setPawbucksSource(source);
 setPawbucksToUse(0);
 setAutoSelected(false);
 };

 // Auto-select best source when dialog opens (prefer earned — those expire in 60 days)
 useEffect(() => {
 if (!open || loadingBalance || pawbucksSource !=="none") return;
 if (spendableBalance > 0) {
 setPawbucksSource("earned");
 setAutoSelected(true);
 } else if (welcomeCreditApplicable && petFundCreditBalance > 0) {
 setPawbucksSource("promotional");
 setAutoSelected(true);
 }
 }, [open, loadingBalance, spendableBalance, welcomeCreditApplicable, petFundCreditBalance, pawbucksSource]);

 // Calculate values
 const pawbucksUsdValue = pawbucksToUse * PAWBUCKS_TO_USD;
 
 // For subscriptions, ensure minimum Stripe charge
 const minStripeForSubscription = isRecurring ? MINIMUM_STRIPE_AMOUNT : 0;
  const subtotalForCap = Math.max(0, priceAmount - minStripeForSubscription);
  const capUsdMax = merchantCap
    ? Math.min(subtotalForCap, maxPawBucksUsdForSubtotal(priceAmount, merchantCap))
    : subtotalForCap;
  const maxPawBucksUsd = capUsdMax;
 const maxPawBucks = Math.min(
 pawbucksBalance, 
 Math.max(0, Math.floor(maxPawBucksUsd / PAWBUCKS_TO_USD))
 );
  const capPctActive = merchantCap ? effectivePawBucksCapPct(merchantCap) : null;
  const promoActive = merchantCap ? isPromoActive(merchantCap) : false;

  // Clamp slider when cap tightens
  useEffect(() => {
    if (pawbucksToUse > maxPawBucks) {
      setPawbucksToUse(Math.max(0, maxPawBucks));
    }
  }, [maxPawBucks, pawbucksToUse]);

 // Default slider to MAX apply once a source is active and balance is known.
 // Only auto-fills while the user hasn't touched it (pawbucksToUse === 0).
 useEffect(() => {
 if (!open || loadingBalance) return;
 if (pawbucksToUse === 0 && maxPawBucks > 0) {
 setPawbucksToUse(maxPawBucks);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [open, loadingBalance, maxPawBucks, pawbucksSource]);
 
 const stripeAmount = Math.max(minStripeForSubscription, priceAmount - pawbucksUsdValue);
 const cashbackPawBucks = stripeAmount > 0 ? Math.round(stripeAmount * cashbackRate) : 0;

 const handleProceed = () => {
 onProceed(pawbucksToUse);
 setPawbucksToUse(0);
 };

 const handleClose = () => {
 setPawbucksToUse(0);
 onOpenChange(false);
 };

 // If merchant doesn't accept PawBucks or user has no balance (and no promo), show simplified version
 const showSimpleCheckout = !merchantAcceptsPawBucks || (pawbucksBalance === 0 && !hasBothSources);

 return (
 <Dialog open={open} onOpenChange={handleClose}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 {showSimpleCheckout ? (
 <>
 <CreditCard className="w-5 h-5 text-primary" />
 Confirm Purchase
 </>
 ) : (
 <>
 <Coins className="w-5 h-5 text-primary" />
 Use PawBucks?
 </>
 )}
 </DialogTitle>
 <DialogDescription>
 {showSimpleCheckout ? (
 `Purchase"${productName}" from ${merchantName}`
 ) : (
 <>
 Would you like to apply PawBucks to this {isRecurring ?'subscription' :'purchase'}?
 <PawBucksInfoTooltip variant="redemption" />
 </>
 )}
 </DialogDescription>
 </DialogHeader>

 {loadingBalance ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 ) : (
 <div className="space-y-4">
 {/* Product Info */}
 <div className="bg-muted rounded-lg p-4">
 <p className="font-medium text-sm mb-1">{productName}</p>
 <p className="text-xl font-bold">{Formatters.currency(priceAmount)}{isRecurring && <span className="text-sm font-normal text-muted-foreground">/period</span>}</p>
 {isRecurring && (
 <p className="text-xs text-muted-foreground mt-1">
 {pawbucksToUse > 0 
 ?"PawBucks discount applies to first payment only"
 :"Recurring subscription"
 }
 </p>
 )}
 </div>

 {/* Source Selector - when both earned and promotional are available */}
 {hasBothSources && (
 <>
 <PawBucksSourceSelector
 earnedBalance={spendableBalance}
 promotionalBalance={petFundCreditBalance}
 selectedSource={pawbucksSource}
 onSourceChange={handleSourceChange}
 promotionalLabel={hasPetFund ?"Pet Fund Credit" :"Welcome Credit"}
 />
 {autoSelected && (
 <div className="text-xs bg-primary/5 border border-primary/20 rounded-md px-3 py-2 text-muted-foreground">
 <span className="font-medium text-primary">Auto-selected:</span>{" "}
 {pawbucksSource ==="earned"
 ?"Earned PawBucks — these expire 60 days after you receive them, so we use them first."
 : `${hasPetFund ?"Pet Fund" :"Welcome"} credit — applied because you have no earned PawBucks available.`}
 {" "}You can switch sources above.
 </div>
 )}
 </>
 )}

 {/* Pet Fund Credit Banner - only when it's the sole source */}
 {welcomeCreditApplicable && !hasBothSources && (
 <div className="bg-success/10 border border-success/20 rounded-lg p-3 flex items-start gap-2">
 <Gift className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
 <div>
 <p className="text-sm font-medium text-success">
 🎉 Pet Fund Credit: {petFundCreditBalance.toLocaleString()} PB ({Formatters.currency((petFundCreditBalance * PAWBUCKS_TO_USD))})
 </p>
 <p className="text-xs text-success/80 mt-0.5">
 Included in your available balance below.
 </p>
 </div>
 </div>
 )}

 {/* Pet Fund not applicable - below minimum */}
 {(hasPetFund || hasWelcomeCredit) && merchantAcceptsPawBucks && priceAmount < petFundMinUsd && (
 <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
 <Gift className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
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
 <p className="text-xs mt-1 text-warning/70">{Formatters.currency(priceAmount)} / {Formatters.currency(petFundMinUsd)} minimum</p>
 </div>
 </div>
 </div>
 )}

 {/* PawBucks Section - only if merchant accepts and user has balance */}
 {merchantAcceptsPawBucks && pawbucksBalance > 0 && maxPawBucks > 0 && (
 <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium flex items-center gap-2">
 <Coins className="w-4 h-4 text-primary" />
 Apply PawBucks
 </span>
 <span className="text-sm text-muted-foreground">
 Balance: {pawbucksBalance.toLocaleString()} PB
 {pawbucksSource ==="promotional" && (
 <span className="text-success ml-1">(credit)</span>
 )}
 </span>
 </div>

                {capPctActive != null && (
                  <PawBucksCapBreakdown
                    merchantCap={merchantCap}
                    subtotalUsd={priceAmount}
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

 {pawbucksToUse > 0 && stripeAmount <= MINIMUM_STRIPE_AMOUNT && !isRecurring && (
 <div className="flex items-center gap-2 text-sm text-success">
 <Check className="w-4 h-4" />
 Entire purchase covered by PawBucks!
 </div>
 )}

 {isRecurring && pawbucksToUse > 0 && (
 <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
 💡 A minimum {Formatters.currency(MINIMUM_STRIPE_AMOUNT)} charge is required to set up recurring billing.
 </div>
 )}
 </div>
 )}

 {/* Info when no PawBucks available */}
 {merchantAcceptsPawBucks && pawbucksBalance === 0 && !hasWelcomeCredit && (
 <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg flex items-start gap-2">
 <Coins className="w-4 h-4 mt-0.5 flex-shrink-0" />
 <span>This merchant accepts PawBucks, but you don't have any spendable yet. Earn PawBucks by making purchases!</span>
 </div>
 )}

 {/* Info about locked rewards */}
 {merchantAcceptsPawBucks && lockedBalance > 0 && pawbucksBalance === 0 && (
 <div className="text-sm text-warning bg-warning/10 p-3 rounded-lg flex items-start gap-2 border border-warning/20">
 <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
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
 <Lock className="w-3 h-3" />
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
 <span className="text-muted-foreground flex items-center gap-1">
 {pawbucksSource ==="promotional" ? (
 <Gift className="w-3 h-3 text-success" />
 ) : (
 <Coins className="w-3 h-3 text-primary" />
 )}
 {pawbucksSource ==="promotional" ?"Credit Discount:" :"PawBucks Discount:"}
 </span>
 <span className="text-primary font-medium">−{Formatters.currency(pawbucksUsdValue)}</span>
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
 </div>
 )}

 <DialogFooter className="flex gap-2 sm:gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={handleClose}
 disabled={isLoading}
 className="flex-1"
 >
 Cancel
 </Button>
 <Button
 onClick={handleProceed}
 disabled={isLoading || loadingBalance}
 className="flex-1"
 >
 {isLoading ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : stripeAmount <= 0 ? (
"Pay with PawBucks"
 ) : (
 `Pay ${Formatters.currency(stripeAmount)}`
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
};
