import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, CreditCard } from "lucide-react";
import { getStripeForConnectedAccount } from "@/lib/stripe";
import { TipSelector } from "@/components/checkout/TipSelector";

type PaymentFormProps = {
  merchantId: string;
  merchantName: string;
  cashbackRate: number;
  userId: string;
  amount: string;
  description: string;
  onSuccess: () => void;
  onCancel: () => void;
};

const PaymentForm = ({
  merchantId,
  merchantName,
  cashbackRate,
  userId,
  amount,
  description,
  onSuccess,
  onCancel,
}: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/wallet`,
        },
        redirect: 'if_required',
      });

      if (error) {
        throw error;
      }

      const paymentAmount = parseFloat(amount);
      const cashbackPawBucks = Math.round(paymentAmount * cashbackRate);
      const rewardsEarned = cashbackPawBucks;

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

  const cashbackPreview = amount && !isNaN(parseFloat(amount))
    ? Math.round(parseFloat(amount) * cashbackRate)
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {amount && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-medium">${parseFloat(amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Points Earned ({cashbackRate}x):</span>
            <span className="font-bold text-accent">+{cashbackPreview} PawBucks</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Payment Details
        </Label>
        <PaymentElement 
          onReady={() => setIsReady(true)}
        />
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading || !stripe || !isReady}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : !isReady ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading payment form...
            </>
          ) : (
            "Pay Now"
          )}
        </Button>
      </div>
    </form>
  );
};

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
  merchantName: string;
  cashbackRate: number;
  userId: string;
  onSuccess: () => void;
};

export const PaymentDialog = ({
  open,
  onOpenChange,
  merchantId,
  merchantName,
  cashbackRate,
  userId,
  onSuccess,
}: PaymentDialogProps) => {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [tipAmount, setTipAmount] = useState(0);
  const [clientSecret, setClientSecret] = useState("");
  const [connectedAccountId, setConnectedAccountId] = useState("");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const handleAmountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingIntent(true);

    try {
      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Call edge function to create payment intent
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: paymentAmount,
          merchantId,
          userId,
          description: description || `Payment to ${merchantName}`,
        },
      });

      if (error) throw error;

      if (data?.error) {
        // Handle backend errors with user-friendly messages
        if (data.error.includes('not available for this merchant')) {
          toast.error(`${merchantName} hasn't completed their payment setup yet. Please ask them to connect their bank account in their Merchant Dashboard.`);
        } else {
          toast.error(data.error);
        }
        return;
      }

      // Store both clientSecret and connectedAccountId for Direct Charges
      setClientSecret(data.clientSecret);
      setConnectedAccountId(data.connectedAccountId);
      setShowPaymentForm(true);
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      const errorMessage = error.message || "Failed to initialize payment";
      
      // Provide helpful error messages
      if (errorMessage.includes('not available for this merchant')) {
        toast.error(`${merchantName} hasn't completed their payment setup yet. Please contact them to complete their merchant onboarding.`);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const handleSuccess = () => {
    setAmount("");
    setDescription("");
    setClientSecret("");
    setConnectedAccountId("");
    setShowPaymentForm(false);
    onOpenChange(false);
    onSuccess();
  };

  const handleCancel = () => {
    setAmount("");
    setDescription("");
    setClientSecret("");
    setConnectedAccountId("");
    setShowPaymentForm(false);
    onOpenChange(false);
  };

  const cashbackPreview = amount && !isNaN(parseFloat(amount))
    ? Math.round(parseFloat(amount) * cashbackRate)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pay {merchantName}</DialogTitle>
          <DialogDescription>
            Earn {cashbackRate}x points on your purchase
          </DialogDescription>
        </DialogHeader>
        
        {!showPaymentForm ? (
          <form onSubmit={handleAmountSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
            {amount && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">${parseFloat(amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Points Earned ({cashbackRate}x):</span>
                  <span className="font-bold text-accent">+{cashbackPreview} PawBucks</span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
                disabled={isCreatingIntent}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isCreatingIntent}>
                {isCreatingIntent ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </form>
        ) : (
          clientSecret && connectedAccountId && (
            <Elements 
              stripe={getStripeForConnectedAccount(connectedAccountId)} 
              options={{ clientSecret }}
              key={`${connectedAccountId}-${clientSecret}`}
            >
              <PaymentForm
                merchantId={merchantId}
                merchantName={merchantName}
                cashbackRate={cashbackRate}
                userId={userId}
                amount={amount}
                description={description}
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