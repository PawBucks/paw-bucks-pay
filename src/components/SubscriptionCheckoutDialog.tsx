import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, Check, CreditCard, RefreshCw, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

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
  onSuccess: () => void;
}

const CheckoutForm = ({
  plan,
  merchantId,
  merchantName,
  onSuccess,
  onClose,
}: {
  plan: SubscriptionCheckoutDialogProps["plan"];
  merchantId: string;
  merchantName: string;
  onSuccess: () => void;
  onClose: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (!stripe || !elements || !user) {
      setError("Payment system not ready. Please try again.");
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

      // Call our edge function to create the subscription
      const result = await merchantSubscriptionsService.create({
        merchantId,
        priceId: plan.stripe_price_id,
        productName: plan.name,
        paymentMethodId: paymentMethod.id,
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

      toast.success(`Subscribed to ${plan.name}!`, {
        description: `Your subscription with ${merchantName} is now active.`,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          <span className="text-2xl font-bold">${(plan.amount / 100).toFixed(2)}</span>
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

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isProcessing}>
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Subscribe
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
      <DialogContent className="max-w-md">
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
            onSuccess={onSuccess}
            onClose={() => onOpenChange(false)}
          />
        </Elements>
      </DialogContent>
    </Dialog>
  );
}
