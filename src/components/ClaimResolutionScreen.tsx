import { useState, useEffect } from"react";
import { useNavigate } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";
import { useSubscription } from"@/hooks/useSubscription";
import { useSpendablePawBucks } from"@/hooks/useSpendablePawBucks";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Progress } from"@/components/ui/progress";
import { Separator } from"@/components/ui/separator";
import { AlertCircle, CreditCard, Coins, Calendar, ChevronRight, Shield, CheckCircle, Loader2, ArrowLeft, Info, Lock } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { toast } from"sonner";
import { motion, AnimatePresence } from"framer-motion";
import { getStripePromise } from"@/lib/stripe";
import { Elements, PaymentElement, useStripe, useElements } from"@stripe/react-stripe-js";
import { buildAppUrl } from"@/lib/url";

import { Formatters } from "@/utils/formatters";
interface ActionRequiredSlice {
 id: string;
 invoice_id: string;
 claim_id: string;
 original_amount: number;
 actual_amount: number;
 gap_amount: number;
 recovery_status: string;
 notes: string | null;
 claim?: {
 claim_number: string;
 denial_reason: string | null;
 service_date: string;
 policy?: {
 pet?: { name: string };
 vet_insurance_providers?: { name: string };
 };
 };
 invoice?: {
 invoice_number: string;
 client_name: string;
 merchant_id: string;
 };
}

interface ClaimResolutionScreenProps {
 sliceId: string;
 onComplete?: () => void;
 onBack?: () => void;
}

// Payment form component for Stripe Elements
function PaymentForm({
 clientSecret,
 amount,
 onSuccess,
 onCancel,
}: {
 clientSecret: string;
 amount: number;
 onSuccess: () => void;
 onCancel: () => void;
}) {
 const stripe = useStripe();
 const elements = useElements();
 const [isProcessing, setIsProcessing] = useState(false);
 const [isReady, setIsReady] = useState(false);

 const handleSubmit = async () => {
 if (!stripe || !elements) return;

 setIsProcessing(true);
 try {
 const { error } = await stripe.confirmPayment({
 elements,
 confirmParams: {
 return_url: buildAppUrl("/dashboard?payment=success"),
 },
 redirect:"if_required",
 });

 if (error) {
 toast.error(error.message ||"Payment failed");
 } else {
 onSuccess();
 }
 } catch (err) {
 toast.error("Payment processing failed");
 } finally {
 setIsProcessing(false);
 }
 };

 return (
 <div className="space-y-4">
 <div className="min-h-[200px]">
 <PaymentElement onReady={() => setIsReady(true)} />
 </div>
 <div className="flex gap-3">
 <Button variant="outline" onClick={onCancel} disabled={isProcessing} className="flex-1">
 Cancel
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={!stripe || !isReady || isProcessing}
 className="flex-1 bg-info hover:bg-info"
 >
 {isProcessing ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Processing...
 </>
 ) : (
 `Pay ${Formatters.currency(amount)}`
 )}
 </Button>
 </div>
 </div>
 );
}

export function ClaimResolutionScreen({
 sliceId,
 onComplete,
 onBack,
}: ClaimResolutionScreenProps) {
 const { user } = useAuth();
 const { subscription } = useSubscription();
 const navigate = useNavigate();
 
 // Use the spendable PawBucks hook to get only available (non-locked) balance
 const { spendableBalance, lockedBalance, isLoading: pawBucksLoading } = useSpendablePawBucks(user?.id);
 
 const [slice, setSlice] = useState<ActionRequiredSlice | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [selectedOption, setSelectedOption] = useState<string | null>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [showSuccess, setShowSuccess] = useState(false);
 const [clientSecret, setClientSecret] = useState<string | null>(null);
 const [paymentStep, setPaymentStep] = useState<"options" |"payment" |"success">("options");

 const stripePromise = getStripePromise();
 
 // Use spendable balance (excludes locked rewards)
 const pawBucksBalance = spendableBalance;

 // Calculate values
 const gapAmount = slice ? Number(slice.gap_amount) : 0;
 const pawBucksValue = pawBucksBalance * 0.001; // 1000 PB = $1
 const canPayFullWithPawBucks = pawBucksValue >= gapAmount;
 const pawBucksToApply = Math.min(pawBucksValue, gapAmount);
 const remainingAfterPawBucks = Math.max(0, gapAmount - pawBucksToApply);
 const installmentAmount = gapAmount / 3;

 // Determine rewards multiplier based on subscription
 const isPawPassPlus = subscription.subscribed && subscription.product_id?.toLowerCase().includes("plus");
 const isPawPass = subscription.subscribed && !isPawPassPlus;
 const rewardsMultiplier = isPawPassPlus ? 30 : isPawPass ? 20 : 10;
 const originalRewardsEarned = slice
 ? Math.floor(Number(slice.original_amount) * rewardsMultiplier)
 : 0;

 useEffect(() => {
 loadData();
 }, [sliceId, user]);

 const loadData = async () => {
 if (!user) return;
 
 setIsLoading(true);
 try {
 // Fetch slice data
 const { data: sliceData, error: sliceError } = await supabase
 .from("invoice_slices")
 .select(`
 *,
 claim:insurance_claims(
 claim_number,
 denial_reason,
 service_date,
 policy:pet_insurance_policies(
 pet:pet_profiles(name),
 vet_insurance_providers(name)
 )
 ),
 invoice:invoices(invoice_number, client_name, merchant_id)
 `)
 .eq("id", sliceId)
 .single();

 if (sliceError) throw sliceError;
 setSlice(sliceData as ActionRequiredSlice);
 // PawBucks balance is now loaded via useSpendablePawBucks hook
 } catch (error) {
 console.error("Error loading resolution data:", error);
 toast.error("Failed to load claim details");
 } finally {
 setIsLoading(false);
 }
 };

 const handlePayNow = async () => {
 if (!slice) return;
 setIsProcessing(true);
 setSelectedOption("pay_now");

 try {
 // Create payment intent for full amount
 const { data, error } = await supabase.functions.invoke("create-payment-intent", {
 body: {
 amount: Math.round(gapAmount * 100),
 description: `Claim balance: ${slice.claim?.claim_number ||"Balance due"}`,
 metadata: {
 slice_id: sliceId,
 type:"claim_recovery",
 },
 },
 });

 if (error) throw error;
 
 setClientSecret(data.clientSecret);
 setPaymentStep("payment");
 } catch (error) {
 console.error("Error creating payment:", error);
 toast.error("Failed to initialize payment");
 } finally {
 setIsProcessing(false);
 }
 };

 const handleUsePawBucks = async () => {
 if (!slice) return;
 setIsProcessing(true);
 setSelectedOption("pawbucks");

 try {
 if (canPayFullWithPawBucks) {
 // Full payment with PawBucks
 const { error } = await supabase.functions.invoke("reconcile-claim-gap", {
 body: {
 sliceId: slice.id,
 action:"select_option",
 option:"pawbucks",
 },
 });

 if (error) throw error;
 
 handleSuccess();
 } else {
 // Partial payment - create payment intent for remainder
 const { data, error } = await supabase.functions.invoke("create-combined-payment", {
 body: {
 amount: Math.round(gapAmount * 100),
 pawbucksAmount: Math.floor(pawBucksToApply * 1000),
 description: `Claim balance: ${slice.claim?.claim_number ||"Balance due"}`,
 metadata: {
 slice_id: sliceId,
 type:"claim_recovery_combined",
 },
 },
 });

 if (error) throw error;
 
 setClientSecret(data.clientSecret);
 setPaymentStep("payment");
 }
 } catch (error) {
 console.error("Error processing PawBucks:", error);
 toast.error("Failed to process payment");
 } finally {
 setIsProcessing(false);
 }
 };

 const handlePaymentPlan = async () => {
 if (!slice) return;
 setIsProcessing(true);
 setSelectedOption("payment_plan");

 try {
 const { error } = await supabase.functions.invoke("reconcile-claim-gap", {
 body: {
 sliceId: slice.id,
 action:"select_option",
 option:"payment_plan",
 },
 });

 if (error) throw error;
 
 handleSuccess();
 } catch (error) {
 console.error("Error creating payment plan:", error);
 toast.error("Failed to create payment plan");
 } finally {
 setIsProcessing(false);
 }
 };

 const handlePaymentSuccess = async () => {
 // Mark slice as funded
 await supabase.functions.invoke("reconcile-claim-gap", {
 body: {
 sliceId: slice?.id,
 action:"mark_funded",
 },
 });
 
 handleSuccess();
 };

 const handleSuccess = () => {
 setPaymentStep("success");
 setShowSuccess(true);
 
 // Navigate back after delay
 setTimeout(() => {
 onComplete?.();
 navigate("/dashboard");
 }, 3000);
 };

 if (isLoading || pawBucksLoading) {
 return (
 <div className="min-h-screen bg-gradient-to-b from-muted to-white flex items-center justify-center">
 <div className="text-center">
 <Loader2 className="h-8 w-8 animate-spin mx-auto text-info" />
 <p className="mt-2 text-muted-foreground">Loading claim details...</p>
 </div>
 </div>
 );
 }

 if (!slice) {
 return (
 <div className="min-h-screen bg-gradient-to-b from-muted to-white flex items-center justify-center p-4">
 <Card className="max-w-md w-full">
 <CardContent className="p-8 text-center">
 <AlertCircle className="h-12 w-12 mx-auto text-warning mb-4" />
 <h2 className="text-xl font-semibold mb-2">Claim Not Found</h2>
 <p className="text-muted-foreground mb-4">
 This claim may have already been resolved or doesn't exist.
 </p>
 <Button onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
 </CardContent>
 </Card>
 </div>
 );
 }

 // Success State
 if (paymentStep ==="success") {
 return (
 <div className="min-h-screen bg-gradient-to-b from-success to-white flex items-center justify-center p-4">
 <motion.div
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 className="max-w-md w-full"
 >
 <Card className="border-success/20 bg-white">
 <CardContent className="p-8 text-center">
 <motion.div
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 transition={{ delay: 0.2, type:"spring" }}
 className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6"
 >
 <CheckCircle className="h-10 w-10 text-success" />
 </motion.div>
 
 <h2 className="text-2xl font-bold text-success mb-2">
 Balance Resolved!
 </h2>
 <p className="text-success mb-6">
 {selectedOption ==="payment_plan"
 ?"Your payment plan has been set up successfully."
 :"Your payment has been processed successfully."}
 </p>

 {/* Rewards Release Notice */}
 <Card className="bg-gradient-to-r from-success to-info border-success/20 mb-6">
 <CardContent className="p-4">
 <div className="flex items-center gap-3">
 <Sparkles className="h-6 w-6 text-success" />
 <div className="text-left">
 <p className="font-medium text-success">Rewards Released!</p>
 <p className="text-sm text-success">
 Your {originalRewardsEarned.toLocaleString()} PawBucks ({rewardsMultiplier}x rewards)
 are now available in your wallet.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 <p className="text-sm text-muted-foreground">
 Redirecting to your dashboard...
 </p>
 </CardContent>
 </Card>
 </motion.div>
 </div>
 );
 }

 // Payment Step
 if (paymentStep ==="payment" && clientSecret) {
 return (
 <div className="min-h-screen bg-gradient-to-b from-muted to-white p-4">
 <div className="max-w-md mx-auto">
 <Button
 variant="ghost"
 onClick={() => setPaymentStep("options")}
 className="mb-4 text-info"
 >
 <ArrowLeft className="h-4 w-4 mr-2" />
 Back to options
 </Button>

 <Card className="border-info/20">
 <CardHeader className="border-b border-info/20">
 <CardTitle className="flex items-center gap-2 text-info">
 <CreditCard className="h-5 w-5" />
 Complete Payment
 </CardTitle>
 </CardHeader>
 <CardContent className="p-6">
 {selectedOption ==="pawbucks" && !canPayFullWithPawBucks && (
 <div className="mb-4 p-3 bg-success/10 rounded-lg border border-success/20">
 <p className="text-sm text-success">
 <Coins className="h-4 w-4 inline mr-1" />
 {Formatters.currency(pawBucksToApply)} in PawBucks applied.
 Remaining: {Formatters.currency(remainingAfterPawBucks)}
 </p>
 </div>
 )}
 
 <Elements stripe={stripePromise} options={{ clientSecret }}>
 <PaymentForm
 clientSecret={clientSecret}
 amount={selectedOption ==="pawbucks" ? remainingAfterPawBucks : gapAmount}
 onSuccess={handlePaymentSuccess}
 onCancel={() => setPaymentStep("options")}
 />
 </Elements>
 </CardContent>
 </Card>
 </div>
 </div>
 );
 }

 // Options Step (Main View)
 return (
 <div className="min-h-screen bg-gradient-to-b from-warning to-white p-4">
 <div className="max-w-lg mx-auto">
 {onBack && (
 <Button variant="ghost" onClick={onBack} className="mb-4 text-warning">
 <ArrowLeft className="h-4 w-4 mr-2" />
 Back
 </Button>
 )}

 {/* Header Card */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 >
 <Card className="border-warning/20 bg-gradient-to-b from-warning to-white mb-4">
 <CardHeader className="pb-2">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-full bg-warning/10">
 <AlertCircle className="h-6 w-6 text-warning" />
 </div>
 <div>
 <CardTitle className="text-warning">Action Required</CardTitle>
 <p className="text-sm text-warning">
 Insurance claim for {slice.claim?.policy?.pet?.name ||"your pet"}
 </p>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="flex items-center justify-between mb-4">
 <div>
 <p className="text-sm text-muted-foreground">Balance Due</p>
 <p className="text-3xl font-bold text-warning">{Formatters.currency(gapAmount)}</p>
 </div>
 <Badge className="bg-destructive/10 text-destructive">
 Claim Denied
 </Badge>
 </div>

 {/* Denial Reason */}
 {slice.claim?.denial_reason && (
 <div className="p-3 bg-muted rounded-lg border border-border mb-4">
 <div className="flex items-start gap-2">
 <Info className="h-4 w-4 text-muted-foreground0 mt-0.5" />
 <div>
 <p className="text-xs font-medium text-foreground uppercase">Carrier Response</p>
 <p className="text-sm text-foreground">{slice.claim.denial_reason}</p>
 </div>
 </div>
 </div>
 )}

 <div className="grid grid-cols-2 gap-3 text-sm">
 <div className="p-2 bg-muted rounded">
 <p className="text-muted-foreground">Claim</p>
 <p className="font-medium">{slice.claim?.claim_number ||"N/A"}</p>
 </div>
 <div className="p-2 bg-muted rounded">
 <p className="text-muted-foreground">Provider</p>
 <p className="font-medium">
 {slice.claim?.policy?.vet_insurance_providers?.name ||"N/A"}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </motion.div>

 <Separator className="my-4 bg-warning/10" />

 {/* Resolution Options */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.1 }}
 className="space-y-3"
 >
 <p className="text-sm font-medium text-foreground">Choose how to resolve:</p>

 {/* Option B: PawBucks First (Highlighted) */}
 {pawBucksBalance > 0 && (
 <Card
 className={`cursor-pointer transition-all border-2 ${
 canPayFullWithPawBucks
 ?"border-success/30 bg-gradient-to-r from-success to-info hover:shadow-md"
 :"border-success/20 bg-success/10 hover:border-success/30"
 }`}
 onClick={() => !isProcessing && handleUsePawBucks()}
 >
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-lg bg-success/10">
 <Coins className="h-6 w-6 text-success" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <p className="font-semibold text-success">Use PawBucks</p>
 {canPayFullWithPawBucks && (
 <Badge className="bg-success text-white text-xs">Recommended</Badge>
 )}
 </div>
 <p className="text-sm text-success">
 {canPayFullWithPawBucks
 ? `Pay full balance with ${Math.ceil(gapAmount * 1000).toLocaleString()} PB`
 : `Apply ${Formatters.currency(pawBucksToApply)} in PawBucks (Remaining: ${Formatters.currency(remainingAfterPawBucks)})`}
 </p>
 </div>
 </div>
 {isProcessing && selectedOption ==="pawbucks" ? (
 <Loader2 className="h-5 w-5 animate-spin text-success" />
 ) : (
 <ChevronRight className="h-5 w-5 text-success" />
 )}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Info about locked rewards if user has some but no spendable */}
 {pawBucksBalance === 0 && lockedBalance > 0 && (
 <Card className="border-warning/20 bg-warning/10">
 <CardContent className="p-4">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-lg bg-warning/10">
 <Lock className="h-5 w-5 text-warning" />
 </div>
 <div>
 <p className="font-medium text-warning">
 You have {lockedBalance.toLocaleString()} locked PawBucks
 </p>
 <p className="text-sm text-warning mt-1">
 These points are currently locked until your recent vet visit is fully processed.
 They cannot be used for this payment.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Option A: Pay Now */}
 <Card
 className="cursor-pointer transition-all border-warning/20 hover:border-warning/30 hover:bg-warning/10"
 onClick={() => !isProcessing && handlePayNow()}
 >
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-lg bg-warning/10">
 <CreditCard className="h-6 w-6 text-warning" />
 </div>
 <div>
 <p className="font-semibold text-warning">Pay Full Balance</p>
 <p className="text-sm text-warning">
 Credit/Debit Card • {Formatters.currency(gapAmount)}
 </p>
 </div>
 </div>
 {isProcessing && selectedOption ==="pay_now" ? (
 <Loader2 className="h-5 w-5 animate-spin text-warning" />
 ) : (
 <ChevronRight className="h-5 w-5 text-warning" />
 )}
 </div>
 </CardContent>
 </Card>

 {/* Option C: Payment Plan */}
 <Card
 className="cursor-pointer transition-all border-info/20 hover:border-info/30 hover:bg-info/10"
 onClick={() => !isProcessing && handlePaymentPlan()}
 >
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-lg bg-info/10">
 <Calendar className="h-6 w-6 text-info" />
 </div>
 <div>
 <p className="font-semibold text-info">Split into 3 Payments</p>
 <p className="text-sm text-info">
 {Formatters.currency(installmentAmount)}/month • No interest
 </p>
 </div>
 </div>
 {isProcessing && selectedOption ==="payment_plan" ? (
 <Loader2 className="h-5 w-5 animate-spin text-info" />
 ) : (
 <ChevronRight className="h-5 w-5 text-info" />
 )}
 </div>
 </CardContent>
 </Card>
 </motion.div>

 {/* Rewards Integrity Note */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2 }}
 className="mt-6"
 >
 <Card className="bg-gradient-to-r from-muted to-info border-info/20">
 <CardContent className="p-4">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-full bg-info/10">
 <Shield className="h-5 w-5 text-info" />
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <Sparkles className="h-4 w-4 text-info" />
 <p className="font-medium text-info">Reward Integrity</p>
 </div>
 <p className="text-sm text-info mt-1">
 Your <span className="font-semibold">{rewardsMultiplier}x rewards</span> earned on
 the original {Formatters.currency(Number(slice.original_amount))} transaction (
 <span className="font-semibold">{originalRewardsEarned.toLocaleString()} PawBucks</span>)
 will be released to your wallet upon resolution.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </motion.div>
 </div>
 </div>
 );
}
