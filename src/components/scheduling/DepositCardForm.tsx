import { useState, useEffect } from"react";
import { Elements, PaymentElement, useStripe, useElements } from"@stripe/react-stripe-js";
import { getStripeForConnectedAccount } from"@/lib/stripe";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { CreditCard, Loader2, Shield } from "lucide-react";

import { Formatters } from "@/utils/formatters";
interface DepositCardFormProps {
 merchantId: string;
 serviceId: string;
 depositAmount: number;
 noShowFeeAmount: number;
 onCardSaved: (paymentMethodId: string, setupIntentId: string) => void;
 onCancel: () => void;
}

function CardFormInner({ 
 depositAmount, 
 noShowFeeAmount, 
 onCardSaved, 
 onCancel,
 setupIntentId,
}: { 
 depositAmount: number; 
 noShowFeeAmount: number; 
 onCardSaved: (paymentMethodId: string, setupIntentId: string) => void;
 onCancel: () => void;
 setupIntentId: string;
}) {
 const stripe = useStripe();
 const elements = useElements();
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!stripe || !elements) return;

 setSubmitting(true);
 setError(null);

 try {
 const { error: submitError, setupIntent } = await stripe.confirmSetup({
 elements,
 redirect:"if_required",
 });

 if (submitError) {
 setError(submitError.message ||"Failed to save card");
 return;
 }

 if (setupIntent?.status ==="succeeded" && setupIntent.payment_method) {
 onCardSaved(setupIntent.payment_method as string, setupIntentId);
 } else {
 setError("Card setup was not completed. Please try again.");
 }
 } catch (err: any) {
 setError(err.message ||"An unexpected error occurred");
 } finally {
 setSubmitting(false);
 }
 };

 return (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20 text-sm">
 <Shield className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
 <div className="text-info">
 <p className="font-medium">Card Required for This Booking</p>
 <p className="mt-1 text-xs">
 {noShowFeeAmount > 0 
 ? `A ${Formatters.currency(noShowFeeAmount)} no-show fee will be charged if you miss your appointment without canceling.` 
 :"Your card will be saved on file. You will only be charged if you miss your appointment."}
 {depositAmount > 0 && ` A ${Formatters.currency(depositAmount)} deposit will be collected now.`}
 </p>
 </div>
 </div>

 <PaymentElement 
 options={{
 layout:"tabs",
 }}
 />

 {error && (
 <p className="text-sm text-destructive">{error}</p>
 )}

 <div className="flex gap-2">
 <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>
 Back
 </Button>
 <Button type="submit" className="flex-1" disabled={submitting || !stripe || !elements}>
 {submitting ? (
 <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
 ) : (
 <><CreditCard className="w-4 h-4 mr-2" /> Save Card & Book</>
 )}
 </Button>
 </div>
 </form>
 );
}

export function DepositCardForm({ merchantId, serviceId, depositAmount, noShowFeeAmount, onCardSaved, onCancel }: DepositCardFormProps) {
 const [clientSecret, setClientSecret] = useState<string | null>(null);
 const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
 const [setupIntentId, setSetupIntentId] = useState<string>("");
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 const createSetupIntent = async () => {
 setLoading(true);
 setError(null);
 try {
 const { data, error: fnError } = await supabase.functions.invoke("create-booking-setup-intent", {
 body: { merchantId, serviceId },
 });

 if (fnError) throw fnError;
 if (data?.error) throw new Error(data.error);

 setClientSecret(data.clientSecret);
 setConnectedAccountId(data.connectedAccountId);
 setSetupIntentId(data.setupIntentId);
 } catch (err: any) {
 setError(err.message ||"Failed to initialize card form");
 } finally {
 setLoading(false);
 }
 };

 createSetupIntent();
 }, [merchantId, serviceId]);

 if (loading) {
 return (
 <div className="flex flex-col items-center justify-center py-8 gap-3">
 <Loader2 className="w-6 h-6 animate-spin text-primary" />
 <p className="text-sm text-muted-foreground">Setting up secure card form...</p>
 </div>
 );
 }

 if (error) {
 return (
 <div className="space-y-3">
 <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
 {error}
 </div>
 <div className="flex gap-2">
 <Button variant="outline" className="flex-1" onClick={onCancel}>Back</Button>
 </div>
 </div>
 );
 }

 if (!clientSecret || !connectedAccountId) return null;

 const stripePromise = getStripeForConnectedAccount(connectedAccountId);

 return (
 <Elements 
 stripe={stripePromise} 
 options={{ 
 clientSecret,
 appearance: {
 theme:"stripe",
 variables: {
 colorPrimary:"#6366f1",
 },
 },
 }}
 >
 <CardFormInner
 depositAmount={depositAmount}
 noShowFeeAmount={noShowFeeAmount}
 onCardSaved={onCardSaved}
 onCancel={onCancel}
 setupIntentId={setupIntentId}
 />
 </Elements>
 );
}
