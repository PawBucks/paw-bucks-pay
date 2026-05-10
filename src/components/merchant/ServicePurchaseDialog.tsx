import { useState, useEffect } from"react";
import { format, addDays, startOfDay, getDay } from"date-fns";
import { Button } from"@/components/ui/button";
import { Calendar } from"@/components/ui/calendar";
import { Badge } from"@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { supabase } from"@/integrations/supabase/client";
import { Elements, PaymentElement, useStripe, useElements } from"@stripe/react-stripe-js";
import { toast } from"sonner";
import { Loader2, Check, CheckCircle2 } from "lucide-react";
import { Label } from"@/components/ui/label";
import { cn } from"@/lib/utils";
import { useAuth } from"@/hooks/useAuth";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { getStripePromise } from"@/lib/stripe";
import { buildAppUrl } from"@/lib/url";

import { Formatters } from "@/utils/formatters";
// Merchant PawBucks conversion: 1000 PawBucks = $1.00
const PAWBUCKS_TO_USD = 0.001;

// Time slots for 60-minute Strategy Consultation (Pacific Time)
const STRATEGY_TIME_SLOTS = [
 { label:"9:00 - 10:00 AM", value:"9:00 AM" },
 { label:"10:15 - 11:15 AM", value:"10:15 AM" },
 { label:"11:30 AM - 12:30 PM", value:"11:30 AM" },
 { label:"12:45 - 1:45 PM", value:"12:45 PM" },
 { label:"2:00 - 3:00 PM", value:"2:00 PM" },
 { label:"3:15 - 4:15 PM", value:"3:15 PM" },
 { label:"4:30 - 5:30 PM", value:"4:30 PM" },
];

type Service = {
 id: string;
 name: string;
 description: string;
 benefits: string[];
 priceUSD: number;
 pricePawBucks: number;
 billingPeriod?:"one_time" |"monthly" |"quarterly" |"yearly";
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
 return_url: buildAppUrl("/merchant/market?purchase=success"),
 },
 redirect:'if_required',
 });

 if (error) throw error;

 toast.success(`Successfully purchased ${serviceName}!`);
 onSuccess();
 } catch (error: any) {
 console.error("Payment error:", error);
 toast.error(error.message ||"Payment failed");
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Service Price:</span>
 <span className="font-medium">{Formatters.currency(totalPrice)}</span>
 </div>
 {pawbucksAmount > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground flex items-center gap-1">
 <span className="w-3 h-3" aria-hidden="true">🐾</span> PawBucks Applied:
 </span>
 <span className="font-medium text-primary">
 {pawbucksAmount.toLocaleString()} (−{Formatters.currency((pawbucksAmount * PAWBUCKS_TO_USD))})
 </span>
 </div>
 )}
 <div className="flex justify-between text-sm border-t pt-2">
 <span className="text-muted-foreground">Pay with Card:</span>
 <span className="font-bold">{Formatters.currency(stripeAmount)}</span>
 </div>
 </div>

 <div className="space-y-2">
 <Label className="flex items-center gap-2">
 <span className="w-4 h-4" aria-hidden="true">💳</span>
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
 `Pay ${Formatters.currency(stripeAmount)}`
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
 const { user } = useAuth();
 const [pawbucksBalance, setPawbucksBalance] = useState(0);
 const [paymentMethod, setPaymentMethod] = useState<'pawbucks' |'usd'>('usd');
 const [clientSecret, setClientSecret] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const [showPaymentForm, setShowPaymentForm] = useState(false);
 const [paymentData, setPaymentData] = useState<any>(null);

 // Calendar state for Strategy Consultation
 const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
 const [selectedTime, setSelectedTime] = useState<string | null>(null);
 const [selectedTimeLabel, setSelectedTimeLabel] = useState<string | null>(null);
 const [bookedSlots, setBookedSlots] = useState<string[]>([]);
 const [isLoadingSlots, setIsLoadingSlots] = useState(false);

 // Check if this is a Strategy Consultation service
 const isStrategyConsultation = service?.name?.toLowerCase().includes("strategy consultation");

 // Get effective user ID for shared accounts
 const sharedAccount = useSharedAccount(userId);
 const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);

 // Load PawBucks balance using effective user ID
 useEffect(() => {
 if (open && effectiveUserId && !sharedAccount.isLoading) {
 loadPawbucksBalance();
 // Reset state when dialog opens
 setPaymentMethod('usd'); // Default to USD
 setClientSecret("");
 setShowPaymentForm(false);
 setPaymentData(null);
 setSelectedDate(undefined);
 setSelectedTime(null);
 setSelectedTimeLabel(null);
 setBookedSlots([]);
 }
 }, [open, effectiveUserId, sharedAccount.isLoading]);

 // Fetch booked slots when date changes (for Strategy Consultation)
 useEffect(() => {
 if (!selectedDate || !isStrategyConsultation) {
 setBookedSlots([]);
 return;
 }

 const fetchBookedSlots = async () => {
 setIsLoadingSlots(true);
 try {
 const dateStr = format(selectedDate,"yyyy-MM-dd");
 const { data, error } = await supabase
 .from("consultation_bookings")
 .select("time_slot")
 .eq("booking_date", dateStr)
 .in("status", ["pending","confirmed"]);

 if (error) throw error;
 setBookedSlots(data?.map((b) => b.time_slot) || []);
 } catch (error) {
 console.error("Failed to fetch booked slots:", error);
 setBookedSlots([]);
 } finally {
 setIsLoadingSlots(false);
 }
 };

 fetchBookedSlots();
 }, [selectedDate, isStrategyConsultation]);

 const loadPawbucksBalance = async () => {
 if (!userId) return;
 
 // Get the merchant ID for this user
 const { data: merchant } = await supabase
 .from('merchants')
 .select('id')
 .eq('user_id', userId)
 .single();
 
 if (!merchant) {
 setPawbucksBalance(0);
 return;
 }
 
 // Fetch from merchant_pawbucks_wallet (merchant's earned PawBucks)
 const { data } = await supabase
 .from('merchant_pawbucks_wallet')
 .select('balance')
 .eq('merchant_id', merchant.id)
 .single();
 
 setPawbucksBalance(data?.balance || 0);
 };

 // Only allow Monday (1), Wednesday (3), and Friday (5)
 const isAllowedDay = (date: Date) => {
 const day = getDay(date);
 return day === 1 || day === 3 || day === 5;
 };

 // Disable days that are not Mon/Wed/Fri, past days, and beyond 30 days
 const disabledDays = (date: Date) => {
 const today = startOfDay(new Date());
 const maxDate = addDays(today, 30);
 
 if (date <= today) return true;
 if (date > maxDate) return true;
 return !isAllowedDay(date);
 };

 if (!service) return null;

 // Check if merchant has enough PawBucks to cover the full PawBucks price
 const canPayWithPawBucks = pawbucksBalance >= service.pricePawBucks;
 // Calculate savings when paying with PawBucks (25% discount)
 const pawbucksSavings = service.priceUSD - (service.pricePawBucks * PAWBUCKS_TO_USD);

 const formatBillingPeriod = (period?: string) => {
 switch (period) {
 case"monthly": return"/month";
 case"quarterly": return"/quarter";
 case"yearly": return"/year";
 default: return" (one-time)";
 }
 };

 // Check if strategy consultation can proceed
 const canProceedWithStrategy = !isStrategyConsultation || (selectedDate && selectedTime);

 const sendStrategyConsultationNotification = async () => {
 if (!selectedDate || !selectedTime || !user) return;

 try {
 const dateStr = format(selectedDate,"yyyy-MM-dd");

 // Insert booking into database
 const { error: bookingError } = await supabase
 .from("consultation_bookings")
 .insert({
 user_id: user.id,
 booking_date: dateStr,
 time_slot: selectedTime,
 status:"confirmed",
 notes: `Strategy Consultation (60 min) - Paid`,
 });

 if (bookingError) {
 console.error("Failed to create booking:", bookingError);
 }

 // Create in-app notification for admin
 await supabase.from("notifications").insert({
 user_id: null,
 title:"Strategy Consultation Purchased",
 message: `${user?.email ||"A merchant"} purchased a Dedicated Strategy Consultation for ${format(selectedDate,"EEEE, MMMM d")} at ${selectedTimeLabel} PT.`,
 category:"consultation",
 is_read: false,
 });

 // Send email notification to admin
 await supabase.functions.invoke("send-consultation-confirmation", {
 body: {
 type:"confirmed",
 recipientEmail:"admin@pawbucks.app",
 bookingDate: format(selectedDate,"EEEE, MMMM d, yyyy"),
 bookingDateRaw: dateStr,
 timeSlot: selectedTime,
 requesterEmail: user?.email,
 merchantName:"Strategy Consultation (60 min)",
 },
 });
 } catch (error) {
 console.error("Failed to send strategy consultation notification:", error);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 // Validate strategy consultation selection
 if (isStrategyConsultation && (!selectedDate || !selectedTime)) {
 toast.error("Please select a date and time for your consultation");
 return;
 }

 setIsLoading(true);

 try {
 // Determine if paying with PawBucks or USD
 const usePawBucks = paymentMethod ==='pawbucks' && canPayWithPawBucks;

 const { data, error } = await supabase.functions.invoke('purchase-market-service', {
 body: {
 serviceId: service.id,
 serviceName: service.name,
 priceUSD: service.priceUSD,
 pricePawBucks: service.pricePawBucks,
 payWithPawBucks: usePawBucks, // Full PawBucks or full USD
 billingPeriod: service.billingPeriod ||'one_time',
 },
 });

 if (error) throw error;
 if (data?.error) throw new Error(data.error);

 setPaymentData(data);

 // Full PawBucks payment - no Stripe needed
 if (data.paymentMethod ==='pawbucks_only') {
 // Send notification for strategy consultation
 if (isStrategyConsultation) {
 await sendStrategyConsultationNotification();
 }
 toast.success(`Successfully purchased ${service.name} using PawBucks!`);
 handleSuccess();
 return;
 }

 // Stripe payment required
 setClientSecret(data.clientSecret);
 setShowPaymentForm(true);
 } catch (error: any) {
 console.error("Purchase error:", error);
 toast.error(error.message ||"Failed to process purchase");
 } finally {
 setIsLoading(false);
 }
 };

 const handleSuccess = async () => {
 // Send notification for strategy consultation after Stripe payment
 if (isStrategyConsultation && !paymentData?.paymentMethod) {
 await sendStrategyConsultationNotification();
 }
 
 setPaymentMethod('usd');
 setClientSecret("");
 setShowPaymentForm(false);
 setPaymentData(null);
 setSelectedDate(undefined);
 setSelectedTime(null);
 setSelectedTimeLabel(null);
 onOpenChange(false);
 onSuccess();
 };

 const handleCancel = () => {
 setPaymentMethod('usd');
 setClientSecret("");
 setShowPaymentForm(false);
 setPaymentData(null);
 setSelectedDate(undefined);
 setSelectedTime(null);
 setSelectedTimeLabel(null);
 onOpenChange(false);
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className={cn(
"max-h-[90vh] overflow-y-auto",
 isStrategyConsultation ?"max-w-lg" :"max-w-md"
 )}>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 {isStrategyConsultation && <span className="w-5 h-5 text-primary" aria-hidden="true">📅</span>}
 Purchase {service.name}
 </DialogTitle>
 <DialogDescription>
 ${service.priceUSD}{formatBillingPeriod(service.billingPeriod)}
 {isStrategyConsultation &&" • 60-minute session"}
 </DialogDescription>
 </DialogHeader>

 {!showPaymentForm ? (
 <form onSubmit={handleSubmit} className="space-y-4">
 {/* Service Summary */}
 <div className="bg-muted rounded-lg p-4 space-y-3">
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

 {/* Calendar for Strategy Consultation */}
 {isStrategyConsultation && (
 <div className="space-y-4 border rounded-lg p-4 bg-primary/5">
 <div>
 <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
 <span className="w-4 h-4" aria-hidden="true">📅</span>
 Select Your Consultation Date
 </h4>
 <p className="text-xs text-muted-foreground mb-3">
 Available Monday, Wednesday & Friday (Pacific Time)
 </p>
 <div className="flex justify-center">
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={(date) => {
 setSelectedDate(date);
 setSelectedTime(null);
 setSelectedTimeLabel(null);
 }}
 disabled={disabledDays}
 fromDate={addDays(new Date(), 1)}
 toDate={addDays(new Date(), 30)}
 className="rounded-md border bg-background pointer-events-auto"
 />
 </div>
 </div>

 {/* Time Slots */}
 {selectedDate && (
 <div>
 <h4 className="text-sm font-medium mb-3">
 Available Times for {format(selectedDate,"MMMM d")} (Pacific Time)
 </h4>
 <div className="grid grid-cols-2 gap-2">
 {STRATEGY_TIME_SLOTS.map((slot) => {
 const isBooked = bookedSlots.includes(slot.value);
 const isSelected = selectedTime === slot.value;
 
 return (
 <Button
 key={slot.value}
 type="button"
 variant={isSelected ?"default" :"outline"}
 size="sm"
 disabled={isBooked}
 onClick={() => {
 setSelectedTime(slot.value);
 setSelectedTimeLabel(slot.label);
 }}
 className={cn(
"text-xs",
 isBooked &&"opacity-50 line-through",
 isSelected &&"ring-2 ring-primary ring-offset-2"
 )}
 >
 {slot.label}
 </Button>
 );
 })}
 </div>
 {bookedSlots.length > 0 && (
 <p className="text-xs text-muted-foreground mt-2">
 Some slots are unavailable (shown with strikethrough)
 </p>
 )}
 </div>
 )}

 {/* Selected Summary */}
 {selectedDate && selectedTime && (
 <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium text-sm">
 {format(selectedDate,"EEEE, MMMM d")}
 </p>
 <p className="text-xs text-muted-foreground">at {selectedTimeLabel} PT</p>
 </div>
 <Badge variant="secondary">
 <span className="w-3 h-3 mr-1" aria-hidden="true">⏰</span>
 60 min
 </Badge>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Payment Method Selection */}
 <div className="space-y-3">
 <Label className="text-sm font-medium">Choose Payment Method</Label>
 
 {/* PawBucks Option */}
 <button
 type="button"
 onClick={() => canPayWithPawBucks && setPaymentMethod('pawbucks')}
 disabled={!canPayWithPawBucks}
 className={cn(
"w-full p-4 rounded-lg border-2 text-left transition-all",
 paymentMethod ==='pawbucks' && canPayWithPawBucks
 ?"border-primary bg-primary/10"
 : canPayWithPawBucks
 ?"border-border hover:border-primary hover:bg-muted"
 :"border-border bg-muted/30 opacity-60 cursor-not-allowed"
 )}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className={cn(
"w-10 h-10 rounded-full flex items-center justify-center",
 paymentMethod ==='pawbucks' && canPayWithPawBucks
 ?"bg-primary text-primary-foreground"
 :"bg-muted"
 )}>
 <span className="w-5 h-5" aria-hidden="true">🐾</span>
 </div>
 <div>
 <p className="font-medium flex items-center gap-2">
 Pay with PawBucks
 {canPayWithPawBucks && pawbucksSavings > 0 && (
 <Badge variant="secondary" className="text-xs bg-accent/20 text-accent">
 Save {Formatters.currency(pawbucksSavings)}!
 </Badge>
 )}
 </p>
 <p className="text-sm text-muted-foreground">
 {canPayWithPawBucks 
 ? `${service.pricePawBucks.toLocaleString()} PawBucks`
 : `Need ${service.pricePawBucks.toLocaleString()} PawBucks (You have ${pawbucksBalance.toLocaleString()})`
 }
 </p>
 </div>
 </div>
 {paymentMethod ==='pawbucks' && canPayWithPawBucks && (
 <Check className="w-5 h-5 text-primary flex-shrink-0" />
 )}
 </div>
 </button>

 {/* USD Option */}
 <button
 type="button"
 onClick={() => setPaymentMethod('usd')}
 className={cn(
"w-full p-4 rounded-lg border-2 text-left transition-all",
 paymentMethod ==='usd'
 ?"border-primary bg-primary/10"
 :"border-border hover:border-primary hover:bg-muted"
 )}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className={cn(
"w-10 h-10 rounded-full flex items-center justify-center",
 paymentMethod ==='usd' ?"bg-primary text-primary-foreground" :"bg-muted"
 )}>
 <span className="w-5 h-5" aria-hidden="true">💳</span>
 </div>
 <div>
 <p className="font-medium">Pay with Card</p>
 <p className="text-sm text-muted-foreground">
 {Formatters.currency(service.priceUSD)} USD
 </p>
 </div>
 </div>
 {paymentMethod ==='usd' && (
 <Check className="w-5 h-5 text-primary flex-shrink-0" />
 )}
 </div>
 </button>

 {/* Balance Info */}
 {pawbucksBalance > 0 && (
 <p className="text-xs text-muted-foreground text-center">
 Your PawBucks Balance: {pawbucksBalance.toLocaleString()} PawBucks
 </p>
 )}
 </div>

 {/* Payment Summary */}
 <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Service:</span>
 <span className="font-medium">{service.name}</span>
 </div>
 <div className="flex justify-between text-sm border-t pt-2">
 <span className="text-muted-foreground">
 {paymentMethod ==='pawbucks' ?'PawBucks Payment:' :'Card Payment:'}
 </span>
 <span className="font-bold">
 {paymentMethod ==='pawbucks' 
 ? `${service.pricePawBucks.toLocaleString()} PawBucks`
 : `${Formatters.currency(service.priceUSD)}`
 }
 </span>
 </div>
 {paymentMethod ==='pawbucks' && pawbucksSavings > 0 && (
 <div className="flex justify-between text-sm text-accent">
 <span>You save:</span>
 <span className="font-medium">{Formatters.currency(pawbucksSavings)}</span>
 </div>
 )}
 </div>

 <div className="flex gap-3">
 <Button type="button" variant="outline" onClick={handleCancel} className="flex-1" disabled={isLoading}>
 Cancel
 </Button>
 <Button 
 type="submit" 
 className="flex-1" 
 disabled={isLoading || !canProceedWithStrategy}
 >
 {isLoading ? (
 <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
 ) : paymentMethod ==='pawbucks' ? (
 <>
 <span className="w-4 h-4 mr-2" aria-hidden="true">🐾</span>
 Pay with PawBucks
 </>
 ) : (
 <>
 <span className="w-4 h-4 mr-2" aria-hidden="true">💳</span>
 Continue to Payment
 </>
 )}
 </Button>
 </div>
 </form>
 ) : (
 clientSecret && paymentData && (
 <Elements stripe={getStripePromise()} options={{ clientSecret }}>
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
