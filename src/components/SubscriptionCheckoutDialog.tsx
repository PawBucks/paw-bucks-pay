import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { merchantSubscriptionsService } from "@/services/api/merchantSubscriptions.service";
import { getStripeForConnectedAccount } from "@/lib/stripe";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Loader2, Check, CreditCard, RefreshCw, Shield, Sparkles, Coins, Lock, Info, Gift } from "lucide-react";
import { toast } from "sonner";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useSpendablePawBucks } from "@/hooks/useSpendablePawBucks";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PawBucksInfoTooltip } from "@/components/PawBucksInfoTooltip";
import { PawBucksSourceSelector, type PawBucksSource } from "@/components/checkout/PawBucksSourceSelector";

// Pet Owner conversion rate: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;
// Minimum Stripe charge for subscriptions
const MINIMUM_STRIPE_AMOUNT = 0.50;
// Minimum transaction for Pet Fund
const PET_FUND_MIN_USD = 20;

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
  } = useSpendablePawBucks(user?.id);

  // Reset slider when dialog is mounted
  useEffect(() => {
    setPawbucksToUse(0);
  }, []);

  const priceAmount = plan.amount / 100; // Convert cents to dollars
  
  const petFundMinUsd = petFundMinTransactionUsd || PET_FUND_MIN_USD;
  const petFundCreditBalance = hasPetFund ? petFundBalance : welcomeCreditBalance;
  const welcomeCreditApplicable = (hasPetFund || hasWelcomeCredit) && merchantAcceptsPawBucks && priceAmount >= petFundMinUsd;
  const effectiveBalance = spendableBalance + (welcomeCreditApplicable ? petFundCreditBalance : 0);
  const pawbucksBalance = effectiveBalance;

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

  const formatInterval = (interval: string, count: number) => {
    const labels: Record<string, [string, string]> = {
      day: ["day", "days"],
      week: ["week", "weeks"],
      month: ["month", "months"],
      year: ["year", "years"],
    };
    const [singular, plural] = labels[interval] || ["period", "periods"];
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
        type: "card",
        card: cardElement,
        billing_details: {
          email: user.email,
        },
      });

      if (pmError) {
        setError(pmError.message || "Failed to process card.");
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
      });

      if (!result.success) {
        // Handle 3D Secure if needed
        if (result.requiresAction && result.clientSecret) {
          const { error: confirmError } = await stripe.confirmCardPayment(result.clientSecret);
          if (confirmError) {
            setError(confirmError.message || "Payment confirmation failed.");
            setIsProcessing(false);
            return;
          }
          // If successful after 3DS, show success
          toast.success(`Subscribed to ${plan.name}!`);
          onSuccess();
          onClose();
          return;
        }

        setError(result.error || "Failed to create subscription.");
        setIsProcessing(false);
        return;
      }

      const pawbucksEarnedMsg = result.pawbucksEarned 
        ? ` You earned ${result.pawbucksEarned} PawBucks!` 
        : "";
      const pawbucksUsedMsg = pawbucksToUse > 0 
        ? ` Used ${pawbucksToUse.toLocaleString()} PawBucks for $${pawbucksUsdValue.toFixed(2)} discount.` 
        : "";

      toast.success(`Subscribed to ${plan.name}!`, {
        description: `Your subscription with ${merchantName} is now active.${pawbucksUsedMsg}${pawbucksEarnedMsg}`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Subscription error:", err);
      setError(err.message || "An unexpected error occurred.");
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
              <span className="text-2xl font-bold">${priceAmount.toFixed(2)}</span>
              <span className="text-muted-foreground">{formatInterval(plan.billing_interval, plan.billing_interval_count)}</span>
            </div>

            {plan.trial_days > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-600/30">
                {plan.trial_days} day free trial
              </Badge>
            )}

            {plan.features.length > 0 && (
              <ul className="space-y-1 pt-2">
                {plan.features.slice(0, 4).map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-3 w-3 text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Welcome Credit Banner */}
          {welcomeCreditApplicable && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-2">
              <Gift className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  🎉 Welcome Credit Available: {welcomeCreditBalance.toLocaleString()} PB (${(welcomeCreditBalance * PAWBUCKS_TO_USD).toFixed(2)})
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                  Your Welcome Credit is included in your available balance below.
                </p>
              </div>
            </div>
          )}

          {/* Pet Fund not applicable - below minimum */}
          {(hasPetFund || hasWelcomeCredit) && merchantAcceptsPawBucks && priceAmount < petFundMinUsd && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
              <Gift className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Pet Fund: ${(petFundCreditBalance * PAWBUCKS_TO_USD).toFixed(2)} available
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                  Add ${(petFundMinUsd - priceAmount).toFixed(2)} more to unlock your Pet Fund credit.
                </p>
                <div className="mt-2">
                  <div className="w-full bg-amber-200/30 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (priceAmount / petFundMinUsd) * 100)}%` }} />
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
                  <Coins className="w-4 h-4 text-primary" />
                  Apply PawBucks
                  <PawBucksInfoTooltip variant="redemption" />
                </span>
                <span className="text-sm text-muted-foreground">
                  Balance: {pawbucksBalance.toLocaleString()} PB
                  {welcomeCreditApplicable && (
                    <span className="text-emerald-600 ml-1">(incl. credit)</span>
                  )}
                </span>
              </div>

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
                <span className={`font-medium ${pawbucksToUse > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {pawbucksToUse > 0 ? `= $${pawbucksUsdValue.toFixed(2)} off` : '$0.00 off'}
                </span>
              </div>

              {pawbucksToUse > 0 && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  💡 A minimum ${MINIMUM_STRIPE_AMOUNT.toFixed(2)} charge is required for recurring billing. PawBucks discount applies to first payment only.
                </div>
              )}
            </div>
          )}

          {/* Info when merchant accepts PawBucks but user has none */}
          {merchantAcceptsPawBucks && pawbucksBalance === 0 && !hasWelcomeCredit && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg flex items-start gap-2">
              <Coins className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>This merchant accepts PawBucks, but you don't have any spendable yet. Earn PawBucks by making purchases!</span>
            </div>
          )}

          {/* Info about locked rewards */}
          {merchantAcceptsPawBucks && lockedBalance > 0 && pawbucksBalance === 0 && (
            <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 p-3 rounded-lg flex items-start gap-2 border border-amber-500/20">
              <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">You have {lockedBalance.toLocaleString()} PawBucks locked</span>
                <p className="text-xs mt-1 text-amber-600/80 dark:text-amber-400/80">
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
                  <div className="flex items-center gap-1 text-xs text-amber-600 cursor-help">
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
              <span>${priceAmount.toFixed(2)}</span>
            </div>
            
            {pawbucksToUse > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PawBucks Discount:</span>
                <span className="text-primary font-medium">−${pawbucksUsdValue.toFixed(2)}</span>
              </div>
            )}

            {pawbucksToUse > 0 && welcomeCreditApplicable && pawbucksToUse > spendableBalance && (
              <div className="flex justify-between text-xs text-emerald-600 pl-4">
                <span>└ includes Welcome Credit</span>
                <span>{Math.min(pawbucksToUse - spendableBalance, welcomeCreditBalance).toLocaleString()} PB</span>
              </div>
            )}
            
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="font-medium">Card Payment:</span>
              <span className="font-bold">${stripeAmount.toFixed(2)}</span>
            </div>
            
            {stripeAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Cashback ({cashbackRate}x):
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
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
                      fontSize: "16px",
                      color: "hsl(var(--foreground))",
                      "::placeholder": { color: "hsl(var(--muted-foreground))" },
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
            <Shield className="h-4 w-4 text-green-600" />
            <span>Secure payment powered by Stripe. Cancel anytime.</span>
          </div>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || !user || isProcessing || loadingBalance}>
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              {pawbucksToUse > 0 ? `Pay $${stripeAmount.toFixed(2)}` : "Subscribe"}
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
