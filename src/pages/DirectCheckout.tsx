import { useState, useEffect } from"react";
import { useParams, useNavigate, useSearchParams } from"react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from"@stripe/react-stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Badge } from"@/components/ui/badge";
import { Skeleton } from"@/components/ui/skeleton";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from"@/integrations/supabase/client";
import { toast } from"sonner";
import { SEO } from"@/components/SEO";
import { getStripeForConnectedAccount } from"@/lib/stripe";
import { buildAppUrl } from"@/lib/url";

import { Formatters } from "@/utils/formatters";
interface Merchant {
 id: string;
 business_name: string;
 description: string | null;
 logo_url: string | null;
 business_type: string;
 onboarding_complete: boolean;
 stripe_account_id: string | null;
}

function CheckoutForm({ 
 amount, 
  originalAmount,
  pawbucksApplied,
  tipAmount,
 merchantName, 
 pawbucksEarned,
 paymentIntentId,
 connectedAccountId,
 onSuccess 
}: { 
 amount: number; 
  originalAmount: number;
  pawbucksApplied: number;
  tipAmount: number;
 merchantName: string;
 pawbucksEarned: number;
 paymentIntentId: string;
 connectedAccountId: string;
 onSuccess: () => void;
}) {
 const stripe = useStripe();
 const elements = useElements();
 const [processing, setProcessing] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [isReady, setIsReady] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!stripe || !elements) return;

 setProcessing(true);
 setError(null);

 try {
 const { error: submitError } = await elements.submit();
 if (submitError) {
 setError(submitError.message ||"Payment failed");
 setProcessing(false);
 return;
 }

 const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
 elements,
 confirmParams: {
 return_url: buildAppUrl("/checkout-success"),
 },
 redirect:'if_required',
 });

 if (confirmError) {
 setError(confirmError.message ||"Payment failed");
 setProcessing(false);
 return;
 }

 // Payment succeeded — call backend to process rewards/transaction
 let confirmSuccess = false;
 let lastError = null;

 for (let attempt = 1; attempt <= 3; attempt++) {
 const { data, error: backendError } = await supabase.functions.invoke(
'confirm-payment-success',
 { body: { paymentIntentId, connectedAccountId } }
 );

 if (!backendError && data?.success) {
 confirmSuccess = true;
 toast.success(`Payment successful! You earned ${data.pawbucksEarned || pawbucksEarned} PawBucks!`);
 break;
 }

 lastError = backendError;
 if (attempt < 3) {
 await new Promise(resolve => setTimeout(resolve, attempt * 1000));
 }
 }

 if (!confirmSuccess) {
 console.error('[DIRECT-CHECKOUT] Backend confirmation failed:', lastError);
 toast.warning("Payment successful! Rewards may take a moment to appear.", {
 description:"If rewards don't appear within a few minutes, please contact support.",
 duration: 8000,
 });
 }

 onSuccess();
 } catch (err: any) {
 setError(err.message ||"An unexpected error occurred");
 } finally {
 setProcessing(false);
 }
 };

 return (
 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="p-4 bg-muted rounded-lg">
 <div className="flex justify-between items-center mb-2">
 <span className="text-muted-foreground">Payment to</span>
 <span className="font-medium">{merchantName}</span>
 </div>
        <div className="flex justify-between items-center mb-1 text-sm">
          <span className="text-muted-foreground">Bill</span>
          <span>{Formatters.currency(originalAmount / 100)}</span>
        </div>
        {tipAmount > 0 && (
          <div className="flex justify-between items-center mb-1 text-sm">
            <span className="text-muted-foreground">Tip</span>
            <span>+{Formatters.currency(tipAmount)}</span>
          </div>
        )}
        {pawbucksApplied > 0 && (
          <div className="flex justify-between items-center mb-1 text-sm text-primary">
            <span>Savings applied</span>
            <span>−{Formatters.currency(pawbucksApplied)}</span>
          </div>
        )}
        <div className="flex justify-between items-center mb-2 pt-2 border-t">
          <span className="text-muted-foreground">Charged to card</span>
          <span className="text-2xl font-bold">{Formatters.currency(amount / 100)}</span>
        </div>
        {tipAmount > 0 && (
          <p className="text-xs text-muted-foreground -mt-1 mb-2">
            Tip is paid in cash equivalent — your savings only apply to the bill.
          </p>
        )}
 <div className="flex justify-between items-center">
 <span className="text-muted-foreground flex items-center gap-1">
 <span className="h-4 w-4" aria-hidden="true">🎁</span>
 PawBucks Earned
 </span>
 <Badge variant="secondary" className="bg-primary/10 text-primary">
 +{pawbucksEarned} PB
 </Badge>
 </div>
 </div>

 <PaymentElement 
 onReady={() => setIsReady(true)}
 />

 {error && (
 <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
 {error}
 </div>
 )}

 <Button 
 type="submit" 
 className="w-full" 
 size="lg"
 disabled={!stripe || processing || !isReady}
 >
 {processing ? (
 <>
 <Loader2 className="h-4 w-4 animate-spin mr-2" />
 Processing...
 </>
 ) : !isReady ? (
 <>
 <Loader2 className="h-4 w-4 animate-spin mr-2" />
 Loading...
 </>
 ) : (
 <>
 <span className="h-4 w-4 mr-2" aria-hidden="true">💵</span>
 Pay {Formatters.currency((amount / 100))}
 </>
 )}
 </Button>
 </form>
 );
}

export default function DirectCheckout() {
 const { merchantId } = useParams<{ merchantId: string }>();
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const prefilledAmount = searchParams.get("amount") ?? "";
 const prefilledTip = searchParams.get("tip") ?? "";
 const [merchant, setMerchant] = useState<Merchant | null>(null);
 const [loading, setLoading] = useState(true);
 const [amount, setAmount] = useState(prefilledAmount);
 const [tip, setTip] = useState<string>(prefilledTip);
 const [description, setDescription] = useState("");
 const [clientSecret, setClientSecret] = useState<string | null>(null);
 const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
 const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
 const [pawbucksEarned, setPawbucksEarned] = useState(0);
 const [stripeAmount, setStripeAmount] = useState<number>(0);
 const [pawbucksApplied, setPawbucksApplied] = useState<number>(0);
 const [creating, setCreating] = useState(false);
 const [success, setSuccess] = useState(false);
 const [autoStarted, setAutoStarted] = useState(false);

 useEffect(() => {
 const fetchMerchant = async () => {
 if (!merchantId) return;

 try {
 const { data, error } = await supabase
 .from("merchants")
 .select("id, business_name, description, logo_url, business_type, onboarding_complete, stripe_account_id")
 .eq("id", merchantId)
 .single();

 if (error) throw error;
 setMerchant(data);
 } catch (error) {
 console.error("Error fetching merchant:", error);
 toast.error("Merchant not found");
 } finally {
 setLoading(false);
 }
 };

 // Check for success return
 const urlParams = new URLSearchParams(window.location.search);
 if (urlParams.get("payment_intent")) {
 setSuccess(true);
 }

 fetchMerchant();
 }, [merchantId]);

 // Frictionless: if amount was passed in via query param and merchant is ready,
 // automatically create the payment intent so the user lands directly on the
 // Stripe card-entry step.
 useEffect(() => {
  if (
   !autoStarted &&
   merchant &&
   merchant.onboarding_complete &&
   merchant.stripe_account_id &&
   prefilledAmount &&
   !clientSecret &&
   !creating
  ) {
   const num = parseFloat(prefilledAmount);
   if (!isNaN(num) && num >= 0.5) {
    setAutoStarted(true);
    handleCreatePayment();
   }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [merchant, prefilledAmount, clientSecret, creating, autoStarted]);

 const handleCreatePayment = async () => {
 const amt = parseFloat(amount);
 if (isNaN(amt) || amt < 0.5) {
 toast.error("Minimum payment is $0.50");
 return;
 }
 const tipAmt = Math.max(0, parseFloat(tip) || 0);

 setCreating(true);
 try {
 // Use Combined Payment with auto-redeem so the user's available
 // PawBucks ($ savings) are automatically applied server-side,
 // reducing the amount actually charged to their card. Tip (if any)
 // is added on top and is USD-only — savings never apply to tip.
 const { data, error } = await supabase.functions.invoke("create-combined-payment", {
 body: {
 merchantId,
 totalAmount: amt + tipAmt,
 pawbucksAmount: 0,
 tipAmount: tipAmt,
 description: description || undefined,
 autoRedeem: true,
 },
 });

 if (error) throw error;
 if (data?.error) throw new Error(data.error);

 // Fully covered by PawBucks — no card charge needed.
 if (data.paymentMethod === "pawbucks_only") {
 toast.success("Paid in full with your savings!");
 navigate("/saved");
 return;
 }

 setClientSecret(data.clientSecret);
 setConnectedAccountId(data.connectedAccountId);
 setPaymentIntentId(data.paymentIntentId);
 setPawbucksEarned(data.pawbucksEarned ?? 0);
      setStripeAmount(Number(data.stripeAmount ?? parseFloat(amount)));
      setPawbucksApplied(Number(data.pawbucksUsdValue ?? 0));
 } catch (error: any) {
 console.error("Error creating payment:", error);
 toast.error(error.message ||"Failed to create payment");
 } finally {
 setCreating(false);
 }
 };

 if (success) {
 return (
 <div className="min-h-screen flex items-center justify-center p-4">
 <SEO title="Payment Success" description="Your payment was successful" />
 <Card className="max-w-md w-full">
 <CardContent className="pt-6 text-center">
 <CheckCircle2 className="h-16 w-16 mx-auto text-primary mb-4" />
 <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
 <p className="text-muted-foreground mb-6">
 Thank you for your payment. PawBucks have been added to your wallet.
 </p>
 <Button onClick={() => navigate("/dashboard")}>
 Go to Dashboard
 </Button>
 </CardContent>
 </Card>
 </div>
 );
 }

 if (loading) {
 return (
 <div className="min-h-screen flex items-center justify-center p-4">
 <Card className="max-w-md w-full">
 <CardHeader>
 <Skeleton className="h-6 w-48" />
 <Skeleton className="h-4 w-full" />
 </CardHeader>
 <CardContent>
 <Skeleton className="h-40 w-full" />
 </CardContent>
 </Card>
 </div>
 );
 }

 if (!merchant) {
 return (
 <div className="min-h-screen flex items-center justify-center p-4">
 <Card className="max-w-md w-full">
 <CardContent className="pt-6 text-center">
 <p className="text-muted-foreground">Merchant not found</p>
 <Button className="mt-4" onClick={() => navigate("/discover")}>
 Browse Merchants
 </Button>
 </CardContent>
 </Card>
 </div>
 );
 }

 if (!merchant.onboarding_complete || !merchant.stripe_account_id) {
 return (
 <div className="min-h-screen flex items-center justify-center p-4">
 <SEO title={`Pay ${merchant.business_name}`} />
 <Card className="max-w-md w-full">
 <CardContent className="pt-6 text-center">
 <span className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true">🏪</span>
 <h2 className="text-xl font-semibold mb-2">{merchant.business_name}</h2>
 <p className="text-muted-foreground">
 This merchant hasn't completed their payment setup yet.
 </p>
 </CardContent>
 </Card>
 </div>
 );
 }

 return (
 <div className="min-h-screen flex items-start lg:items-center justify-center p-4 lg:p-8 bg-muted/30">
 <SEO 
 title={`Pay ${merchant.business_name}`} 
 description={`Make a payment to ${merchant.business_name}`}
 />
 
  <Card className="w-full max-w-md lg:max-w-5xl lg:grid lg:grid-cols-5 lg:gap-0 lg:overflow-hidden">
   <CardHeader className="text-center lg:col-span-2 lg:text-left lg:bg-gradient-to-br lg:from-primary/5 lg:to-accent/5 lg:p-10 lg:flex lg:flex-col lg:justify-center lg:border-r">
 {merchant.logo_url && (
 <img 
 src={merchant.logo_url} 
 alt={merchant.business_name}
      className="h-16 w-16 lg:h-24 lg:w-24 object-cover rounded-full mx-auto lg:mx-0 mb-2 lg:mb-4"
 />
 )}
    <CardTitle className="flex items-center justify-center lg:justify-start gap-2 lg:text-3xl">
 <span className="h-5 w-5" aria-hidden="true">🏪</span>
 {merchant.business_name}
 </CardTitle>
    <CardDescription className="lg:text-base lg:mt-2">
 {merchant.description || `Pay ${merchant.business_name}`}
 </CardDescription>
    <div className="hidden lg:flex items-center gap-2 mt-6 text-sm text-muted-foreground">
     <span className="h-4 w-4 text-primary" aria-hidden="true">🎁</span>
     <span>Earn PawBucks on every purchase</span>
    </div>
 </CardHeader>

   <CardContent className="lg:col-span-3 lg:p-10">
 {!clientSecret ? (
 <div className="space-y-4">
 <div>
 <Label htmlFor="amount">Amount (USD)</Label>
 <div className="relative mt-1">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true">💵</span>
 <Input
 id="amount"
 type="number"
 step="0.01"
 min="0.50"
 placeholder="0.00"
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 className="pl-9"
 />
 </div>
 </div>

 <div>
 <Label htmlFor="description">Description (optional)</Label>
 <Input
 id="description"
 placeholder="What's this payment for?"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 className="mt-1"
 />
 </div>

 {amount && parseFloat(amount) >= 0.5 && (
 <div className="p-3 bg-primary/5 rounded-lg flex items-center justify-between">
 <span className="text-sm flex items-center gap-1">
 <span className="h-4 w-4 text-primary" aria-hidden="true">🎁</span>
 You'll earn
 </span>
 <Badge variant="secondary" className="bg-primary/10 text-primary">
 +{Math.round(parseFloat(amount) * 10)} PawBucks
 </Badge>
 </div>
 )}

 <Button 
 className="w-full" 
 size="lg"
 onClick={handleCreatePayment}
 disabled={!amount || parseFloat(amount) < 0.5 || creating}
 >
 {creating ? (
 <>
 <Loader2 className="h-4 w-4 animate-spin mr-2" />
 Creating Payment...
 </>
 ) : (
"Continue to Payment"
 )}
 </Button>
 </div>
 ) : (
 <Elements 
 stripe={getStripeForConnectedAccount(connectedAccountId!)} 
 options={{ 
 clientSecret,
 appearance: { theme:"stripe" },
 }}
 >
 <CheckoutForm 
              amount={Math.round(stripeAmount * 100)}
              originalAmount={Math.round(parseFloat(amount) * 100)}
              pawbucksApplied={pawbucksApplied}
             tipAmount={Math.max(0, parseFloat(tip) || 0)}
 merchantName={merchant.business_name}
 pawbucksEarned={pawbucksEarned}
 paymentIntentId={paymentIntentId!}
 connectedAccountId={connectedAccountId!}
 onSuccess={() => setSuccess(true)}
 />
 </Elements>
 )}
 </CardContent>
 </Card>
 </div>
 );
}
