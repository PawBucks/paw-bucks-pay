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
import { Loader2, CreditCard, Coins, Check, AlertCircle } from "lucide-react";
import { PawBucksInfoTooltip } from "@/components/PawBucksInfoTooltip";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";
import { getStripeForConnectedAccount } from "@/lib/stripe";

// Pet Owner conversion rate: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;

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
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/wallet`,
        },
        redirect: 'if_required',
      });

      if (error) throw error;

      // Payment succeeded on Stripe - now call our backend to process rewards/transaction
      console.log('[PAYMENT] Stripe payment confirmed, calling confirm-payment-success...');
      
      const { data: confirmData, error: confirmError } = await supabase.functions.invoke(
        'confirm-payment-success',
        {
          body: { paymentIntentId, connectedAccountId },
        }
      );

      if (confirmError) {
        console.error('[PAYMENT] confirm-payment-success error:', confirmError);
        // Payment went through but backend processing failed - still show success but warn
        toast.warning("Payment successful, but rewards may be delayed. Please check your wallet.");
      } else {
        console.log('[PAYMENT] confirm-payment-success result:', confirmData);
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

  // Show loading state until PaymentElement is ready
  if (!isReady && !loadError) {
    return (
      <div className="space-y-4">
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
        </div>
        
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading payment form...</p>
        </div>
        
        {/* Hidden PaymentElement that triggers onReady */}
        <div className="min-h-[200px]">
          <PaymentElement 
            onReady={() => setIsReady(true)} 
            onLoadError={(error) => setLoadError(error.error.message)}
          />
        </div>
        
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button type="button" className="flex-1" disabled>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...
          </Button>
        </div>
      </div>
    );
  }

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
        <div className="min-h-[200px]">
          <PaymentElement />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading || !stripe}>
          {isLoading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
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
  const [pawbucksBalance, setPawbucksBalance] = useState(0);
  const [clientSecret, setClientSecret] = useState("");
  const [connectedAccountId, setConnectedAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  // Get effective user ID for shared accounts
  const sharedAccount = useSharedAccount(userId);
  const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);

  // Load PawBucks balance using effective user ID
  useEffect(() => {
    if (open && effectiveUserId && acceptsPawbucks && !sharedAccount.isLoading) {
      loadPawbucksBalance();
    }
  }, [open, effectiveUserId, acceptsPawbucks, sharedAccount.isLoading]);

  const loadPawbucksBalance = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('pawbucks_wallet')
      .select('balance')
      .eq('user_id', effectiveUserId)
      .single();
    
    setPawbucksBalance(data?.balance || 0);
  };

  const totalAmount = parseFloat(amount) || 0;
  const pawbucksUsdValue = pawbucksToUse * PAWBUCKS_TO_USD;
  const stripeAmount = Math.max(0, totalAmount - pawbucksUsdValue);
  const maxPawbucks = Math.min(pawbucksBalance, Math.ceil(totalAmount / PAWBUCKS_TO_USD));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setPawbucksToUse(0); // Reset PawBucks when amount changes
                }}
                required
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

            {/* PawBucks Section */}
            {acceptsPawbucks && totalAmount > 0 && pawbucksBalance > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary" />
                    Use PawBucks
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    Balance: {pawbucksBalance.toLocaleString()} PawBucks
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
                  step={1}
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

            {acceptsPawbucks && pawbucksBalance === 0 && totalAmount > 0 && (
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
                  "Continue"
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