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
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { Loader2, CreditCard, Coins, Check } from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Pet Owner conversion rate: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;

type PaymentFormProps = {
  merchantName: string;
  cashbackRate: number;
  stripeAmount: number;
  pawbucksAmount: number;
  totalAmount: number;
  onSuccess: () => void;
  onCancel: () => void;
};

const StripePaymentForm = ({
  merchantName,
  cashbackRate,
  stripeAmount,
  pawbucksAmount,
  totalAmount,
  onSuccess,
  onCancel,
}: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

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

      const cashbackPawBucks = Math.round(stripeAmount * cashbackRate / 100);
      toast.success(
        `Payment successful! You earned ${cashbackPawBucks} PawBucks!`
      );
      onSuccess();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Cashback is earned as PawBucks directly (10% of dollar amount = that many PawBucks)
  const cashbackPawBucks = Math.round(stripeAmount * cashbackRate / 100);

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
          <span className="text-muted-foreground">Cashback ({cashbackRate}%):</span>
          <span className="font-bold text-accent">+{cashbackPawBucks} PawBucks</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Payment Details
        </Label>
        <PaymentElement onReady={() => setIsReady(true)} />
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
  const [pawbucksBalance, setPawbucksBalance] = useState(0);
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  // Load PawBucks balance
  useEffect(() => {
    if (open && userId && acceptsPawbucks) {
      loadPawbucksBalance();
    }
  }, [open, userId, acceptsPawbucks]);

  const loadPawbucksBalance = async () => {
    const { data } = await supabase
      .from('pawbucks_wallet')
      .select('balance')
      .eq('user_id', userId)
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

      // Stripe payment required
      setClientSecret(data.clientSecret);
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
    setShowPaymentForm(false);
    setPaymentData(null);
    onOpenChange(false);
  };

  // Cashback is earned as PawBucks (10% of dollar amount = that many PawBucks)
  const cashbackPawBucks = stripeAmount > 0 ? Math.round(stripeAmount * cashbackRate / 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pay {merchantName}</DialogTitle>
          <DialogDescription>
            Earn {cashbackRate}% cashback on card payments
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
                    Balance: {pawbucksBalance} PawBucks
                  </span>
                </div>

                <Slider
                  value={[pawbucksToUse]}
                  onValueChange={([value]) => setPawbucksToUse(value)}
                  max={maxPawbucks}
                  min={0}
                  step={1}
                  className="w-full"
                />

                <div className="flex justify-between text-sm">
                  <span>{pawbucksToUse} PawBucks</span>
                  <span className="font-medium text-primary">
                    = ${pawbucksUsdValue.toFixed(2)} off
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
                      <span className="text-muted-foreground">Cashback ({cashbackRate}%):</span>
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
        ) : (
          clientSecret && paymentData && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripePaymentForm
                merchantName={merchantName}
                cashbackRate={paymentData.cashbackRate}
                stripeAmount={paymentData.stripeAmount}
                pawbucksAmount={paymentData.pawbucksAmount}
                totalAmount={totalAmount}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </Elements>
          )
        )}
      </DialogContent>
    </Dialog>
  );
};