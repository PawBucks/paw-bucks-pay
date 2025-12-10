import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { Loader2, CreditCard, Coins, Check, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Merchant PawBucks conversion: 1000 PawBucks = $1.00
const PAWBUCKS_TO_USD = 0.001;

type Service = {
  id: string;
  name: string;
  description: string;
  benefits: string[];
  priceUSD: number;
  pricePawBucks: number;
  billingPeriod?: "one-time" | "monthly" | "quarterly" | "annual";
};

type StripePaymentFormProps = {
  serviceName: string;
  stripeAmount: number;
  pawbucksAmount: number;
  totalPrice: number;
  onSuccess: () => void;
  onCancel: () => void;
};

const StripePaymentForm = ({
  serviceName,
  stripeAmount,
  pawbucksAmount,
  totalPrice,
  onSuccess,
  onCancel,
}: StripePaymentFormProps) => {
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
          return_url: `${window.location.origin}/merchant/market?purchase=success`,
        },
        redirect: 'if_required',
      });

      if (error) throw error;

      toast.success(`Successfully purchased ${serviceName}!`);
      onSuccess();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Service Price:</span>
          <span className="font-medium">${totalPrice.toFixed(2)}</span>
        </div>
        {pawbucksAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Coins className="w-3 h-3" /> PawBucks Applied:
            </span>
            <span className="font-medium text-primary">
              {pawbucksAmount.toLocaleString()} (−${(pawbucksAmount * PAWBUCKS_TO_USD).toFixed(2)})
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm border-t pt-2">
          <span className="text-muted-foreground">Pay with Card:</span>
          <span className="font-bold">${stripeAmount.toFixed(2)}</span>
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

type ServicePurchaseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null;
  userId: string;
  onSuccess: () => void;
};

export const ServicePurchaseDialog = ({
  open,
  onOpenChange,
  service,
  userId,
  onSuccess,
}: ServicePurchaseDialogProps) => {
  const [pawbucksToUse, setPawbucksToUse] = useState(0);
  const [pawbucksBalance, setPawbucksBalance] = useState(0);
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  // Load PawBucks balance
  useEffect(() => {
    if (open && userId) {
      loadPawbucksBalance();
      // Reset state when dialog opens
      setPawbucksToUse(0);
      setClientSecret("");
      setShowPaymentForm(false);
      setPaymentData(null);
    }
  }, [open, userId]);

  const loadPawbucksBalance = async () => {
    const { data } = await supabase
      .from('pawbucks_wallet')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    setPawbucksBalance(data?.balance || 0);
  };

  if (!service) return null;

  const pawbucksUsdValue = pawbucksToUse * PAWBUCKS_TO_USD;
  const stripeAmount = Math.max(0, service.priceUSD - pawbucksUsdValue);
  const maxPawbucks = Math.min(pawbucksBalance, service.pricePawBucks);

  const formatBillingPeriod = (period?: string) => {
    switch (period) {
      case "monthly": return "/month";
      case "quarterly": return "/quarter";
      case "annual": return "/year";
      default: return " (one-time)";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('purchase-market-service', {
        body: {
          serviceId: service.id,
          serviceName: service.name,
          priceUSD: service.priceUSD,
          pricePawBucks: service.pricePawBucks,
          pawbucksToUse,
          billingPeriod: service.billingPeriod || 'one-time',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPaymentData(data);

      // Full PawBucks payment - no Stripe needed
      if (data.paymentMethod === 'pawbucks_only') {
        toast.success(`Successfully purchased ${service.name} using PawBucks!`);
        handleSuccess();
        return;
      }

      // Stripe payment required
      setClientSecret(data.clientSecret);
      setShowPaymentForm(true);
    } catch (error: any) {
      console.error("Purchase error:", error);
      toast.error(error.message || "Failed to process purchase");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    setPawbucksToUse(0);
    setClientSecret("");
    setShowPaymentForm(false);
    setPaymentData(null);
    onOpenChange(false);
    onSuccess();
  };

  const handleCancel = () => {
    setPawbucksToUse(0);
    setClientSecret("");
    setShowPaymentForm(false);
    setPaymentData(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Purchase {service.name}</DialogTitle>
          <DialogDescription>
            ${service.priceUSD}{formatBillingPeriod(service.billingPeriod)}
          </DialogDescription>
        </DialogHeader>

        {!showPaymentForm ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Service Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-muted-foreground">{service.description}</p>
              <div className="space-y-1">
                {service.benefits.slice(0, 3).map((benefit, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PawBucks Section */}
            {pawbucksBalance > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary" />
                    Use PawBucks
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    Balance: {pawbucksBalance.toLocaleString()}
                  </span>
                </div>

                <Slider
                  value={[pawbucksToUse]}
                  onValueChange={([value]) => setPawbucksToUse(value)}
                  max={maxPawbucks}
                  min={0}
                  step={1000}
                  className="w-full"
                />

                <div className="flex justify-between text-sm">
                  <span>{pawbucksToUse.toLocaleString()} PawBucks</span>
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

            {pawbucksBalance === 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <Coins className="w-4 h-4 inline mr-1" />
                You can earn PawBucks from transactions on the platform to use here!
              </div>
            )}

            {/* Payment Summary */}
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Price:</span>
                <span className="font-medium">${service.priceUSD.toFixed(2)}</span>
              </div>
              {pawbucksToUse > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PawBucks Discount:</span>
                  <span className="text-primary">−${pawbucksUsdValue.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">
                  {stripeAmount > 0 ? 'Card Payment:' : 'Total:'}
                </span>
                <span className="font-bold">
                  {stripeAmount > 0 ? `$${stripeAmount.toFixed(2)}` : '$0.00'}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleCancel} className="flex-1" disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                ) : stripeAmount <= 0 && pawbucksToUse > 0 ? (
                  'Purchase with PawBucks'
                ) : (
                  'Continue to Payment'
                )}
              </Button>
            </div>
          </form>
        ) : (
          clientSecret && paymentData && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripePaymentForm
                serviceName={service.name}
                stripeAmount={paymentData.stripeAmount}
                pawbucksAmount={paymentData.pawbucksToDeduct}
                totalPrice={service.priceUSD}
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
