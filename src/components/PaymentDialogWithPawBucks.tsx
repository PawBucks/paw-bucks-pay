import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { Loader2, CreditCard, Coins, Check, AlertCircle, Gift } from "lucide-react";
import { PawBucksInfoTooltip } from "@/components/PawBucksInfoTooltip";
import { useSpendablePawBucks } from "@/hooks/useSpendablePawBucks";
import { PawBucksSourceSelector, type PawBucksSource } from "@/components/checkout/PawBucksSourceSelector";
import { getStripeForConnectedAccount } from "@/lib/stripe";

// Pet Owner conversion rate: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;
// Minimum transaction for Pet Fund credits (dynamic, but defaults)
const PET_FUND_INITIAL_MIN_USD = 40;
const PET_FUND_MONTHLY_MIN_USD = 20;

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
          return_url: `${window.location.origin}/wallet`,
        },
        redirect: 'if_required',
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
          description: "If rewards don't appear within a few minutes, please contact support.",
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
      toast.error(error.message || "Payment failed");
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
          <span className="font-medium">${totalAmount.toFixed(2)}</span>
        </div>
        {pawbucksAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Coins className="w-3 h-3" /> PawBucks Used:
            </span>
            <span className="font-medium text-primary">
              {pawbucksAmount} (−${(pawbucksAmount * PAWBUCKS_TO_USD).toFixed(2)})
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm border-t pt-2">
          <span className="text-muted-foreground">Pay with Card:</span>
          <span className="font-bold">${stripeAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Points Earned ({cashbackRate}x):</span>
          <span className="font-bold text-accent">+{cashbackPawBucks} PawBucks</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
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
            `Pay $${stripeAmount.toFixed(2)}`
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
  const [pawbucksToUse, setPawbucksToUse] = useState(0);
  const [pawbucksSource, setPawbucksSource] = useState<PawBucksSource>("none");
  const [clientSecret, setClientSecret] = useState("");
  const [connectedAccountId, setConnectedAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  // Use the spendable PawBucks hook which includes Pet Fund
  const {
    spendableBalance,
    welcomeCreditBalance,
    hasWelcomeCredit,
    hasPetFund,
    petFundBalance,
    petFundMinTransactionUsd,
    isLoading: loadingBalance,
  } = useSpendablePawBucks(userId);

  const totalAmount = parseFloat(amount) || 0;

  // Pet Fund / Welcome credit applicable if merchant accepts PawBucks and meets min transaction
  const petFundMinUsd = petFundMinTransactionUsd || PET_FUND_MONTHLY_MIN_USD;
  const petFundApplicable = (hasPetFund || hasWelcomeCredit) && acceptsPawbucks && totalAmount >= petFundMinUsd;
  const petFundCreditBalance = hasPetFund ? petFundBalance : welcomeCreditBalance;

  // For backwards compat, keep these names
  const welcomeCreditApplicable = petFundApplicable;

  // Both sources available → user must choose one
  const hasBothSources = spendableBalance > 0 && petFundApplicable && petFundCreditBalance > 0;

  // Determine effective balance based on selected source
  const pawbucksBalance = hasBothSources
    ? (pawbucksSource === "earned" ? spendableBalance : pawbucksSource === "promotional" ? petFundCreditBalance : 0)
    : (spendableBalance + (petFundApplicable ? petFundCreditBalance : 0));

  const handleSourceChange = (source: PawBucksSource) => {
    setPawbucksSource(source);
    setPawbucksToUse(0);
  };

  const pawbucksUsdValue = pawbucksToUse * PAWBUCKS_TO_USD;
  const stripeAmount = Math.max(0, totalAmount - pawbucksUsdValue);
  const maxPawbucks = Math.min(pawbucksBalance, Math.ceil(totalAmount / PAWBUCKS_TO_USD));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmount < 0.50 && pawbucksToUse <= 0) {
      toast.error("Minimum payment amount is $0.50");
      return;
    }
    if (totalAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-combined-payment', {
        body: {
          totalAmount,
          pawbucksAmount: pawbucksToUse,
          merchantId,
          description: description || `Payment to ${merchantName}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPaymentData(data);

      // Full PawBucks payment - no Stripe needed
      if (data.paymentMethod === 'pawbucks_only') {
        toast.success(`Payment of $${totalAmount.toFixed(2)} completed using ${pawbucksToUse} PawBucks!`);
        handleSuccess();
        return;
      }

      // Stripe payment required - store both clientSecret and connectedAccountId
      setClientSecret(data.clientSecret);
      setConnectedAccountId(data.connectedAccountId);
      setShowPaymentForm(true);
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Failed to initialize payment");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    setAmount("");
    setDescription("");
    setPawbucksToUse(0);
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
    setPawbucksToUse(0);
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
                  setPawbucksToUse(0); // Reset PawBucks when amount changes
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

            {/* Source Selector - when both earned and promotional are available */}
            {hasBothSources && totalAmount > 0 && (
              <PawBucksSourceSelector
                earnedBalance={spendableBalance}
                promotionalBalance={petFundCreditBalance}
                selectedSource={pawbucksSource}
                onSourceChange={handleSourceChange}
                promotionalLabel={hasPetFund ? "Pet Fund Credit" : "Welcome Credit"}
              />
            )}

            {/* Pet Fund Credit Banner - only when sole source */}
            {petFundApplicable && !hasBothSources && totalAmount > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-2">
                <Gift className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    🎉 Pet Fund Credit Available: {petFundCreditBalance.toLocaleString()} PB (${(petFundCreditBalance * PAWBUCKS_TO_USD).toFixed(2)})
                  </p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                    Your Pet Fund credit is included in your balance below. Use the slider to apply it!
                  </p>
                </div>
              </div>
            )}

            {/* Pet Fund not applicable - below minimum */}
            {(hasPetFund || hasWelcomeCredit) && acceptsPawbucks && totalAmount > 0 && totalAmount < petFundMinUsd && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                <Gift className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Pet Fund: ${(petFundCreditBalance * PAWBUCKS_TO_USD).toFixed(2)} available
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    Add ${(petFundMinUsd - totalAmount).toFixed(2)} more to unlock your Pet Fund credit.
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="w-full bg-amber-200/30 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (totalAmount / petFundMinUsd) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs mt-1 text-amber-600/70">
                      ${totalAmount.toFixed(2)} / ${petFundMinUsd.toFixed(2)} minimum
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
                    <Coins className="w-4 h-4 text-primary" />
                    Use PawBucks
                  </Label>
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
                  <span className={`font-medium ${pawbucksToUse > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {pawbucksToUse > 0 ? `= $${pawbucksUsdValue.toFixed(2)} off` : '$0.00 off'}
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
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <Coins className="w-4 h-4 inline mr-1" />
                This merchant accepts PawBucks, but you don't have any yet. Earn PawBucks by making purchases!
              </div>
            )}

            {/* Payment Summary */}
            {totalAmount > 0 && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">${totalAmount.toFixed(2)}</span>
                </div>
                {pawbucksToUse > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">PawBucks:</span>
                    <span className="text-primary">−${pawbucksUsdValue.toFixed(2)}</span>
                  </div>
                )}
                {stripeAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">Card Payment:</span>
                      <span className="font-bold">${stripeAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Points Earned ({cashbackRate}x):</span>
                      <span className="font-bold text-accent">+{cashbackPawBucks} PawBucks</span>
                    </div>
                  </>
                )}
                {stripeAmount <= 0 && pawbucksToUse > 0 && (
                  <div className="text-sm text-center text-accent font-medium pt-2 border-t">
                    No card payment needed!
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleCancel} className="flex-1" disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
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
              paymentIntentId={paymentData?.paymentIntentId || ''}
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