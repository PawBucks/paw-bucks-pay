import { useState, useMemo, useEffect, useCallback } from"react";
import { GroomingPetSelector, createDefaultGroomingData, type GroomingPetData } from"./GroomingPetSelector";
import { DepositCardForm } from"./DepositCardForm";
import { useAuth } from"@/hooks/useAuth";
import { useNavigate, useLocation } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { 
 schedulingService,
 isFlashSaleActive,
 calculateRegularPawbucksPrice,
 calculateFlashSaleSavings
} from"@/services/api/scheduling.service";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Calendar } from"@/components/ui/calendar";
import { Textarea } from"@/components/ui/textarea";
import { Label } from"@/components/ui/label";
import { Skeleton } from"@/components/ui/skeleton";
import { toast } from"sonner";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { format, addDays, isSameDay, parseISO, isAfter, startOfDay } from"date-fns";
import { Calendar as CalendarIcon, Loader2, CheckCircle2, ArrowRight, Timer } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { Input } from"@/components/ui/input";

import { Formatters } from "@/utils/formatters";
// Flash Sale Countdown component for service listings
function FlashSaleCountdown({ endAt }: { endAt: string }) {
 const [timeRemaining, setTimeRemaining] = useState<string>("");

 useEffect(() => {
 const updateCountdown = () => {
 const now = new Date();
 const end = new Date(endAt);
 const diff = end.getTime() - now.getTime();
 
 if (diff <= 0) {
 setTimeRemaining("Ended");
 return;
 }
 
 const hours = Math.floor(diff / (1000 * 60 * 60));
 const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
 
 if (hours > 24) {
 const days = Math.floor(hours / 24);
 setTimeRemaining(`Ends in ${days}d ${hours % 24}h`);
 } else if (hours > 0) {
 setTimeRemaining(`Ends in ${hours}h ${minutes}m`);
 } else {
 setTimeRemaining(`Ends in ${minutes}m`);
 }
 };
 
 updateCountdown();
 const interval = setInterval(updateCountdown, 60000);
 
 return () => clearInterval(interval);
 }, [endAt]);

 if (!timeRemaining) return null;

 return (
 <div className="flex items-center gap-1 text-warning text-xs justify-end">
 <Timer className="w-3 h-3" />
 <span>{timeRemaining}</span>
 </div>
 );
}

type Props = {
 merchantId: string;
 merchantName: string;
 cashbackRate?: number;
};

export const BookingWidget = ({ merchantId, merchantName, cashbackRate = 10 }: Props) => {
 const { user } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const queryClient = useQueryClient();
 
 const [selectedService, setSelectedService] = useState<string | null>(null);
 const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
 const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
 const [notes, setNotes] = useState("");
 const [step, setStep] = useState<"service" |"date" |"time" |"confirm" |"deposit">("service");
 const [groomingData, setGroomingData] = useState<GroomingPetData>(createDefaultGroomingData());
 const [savedPaymentMethodId, setSavedPaymentMethodId] = useState<string | null>(null);
 const [savedSetupIntentId, setSavedSetupIntentId] = useState<string | null>(null);
 const [serviceAddress, setServiceAddress] = useState("");

 // Fetch only active services for public booking
 const { data: services = [], isLoading: servicesLoading } = useQuery({
 queryKey: ["merchant-services-active", merchantId],
 queryFn: () => schedulingService.getActiveServices(merchantId),
 });

 // Fetch availability
 const { data: availability = [] } = useQuery({
 queryKey: ["merchant-availability", merchantId],
 queryFn: () => schedulingService.getAvailability(merchantId),
 });

 // Fetch overrides
 const { data: overrides = [] } = useQuery({
 queryKey: ["merchant-overrides", merchantId],
 queryFn: () => schedulingService.getOverrides(merchantId),
 });

  // Pre-check: does this merchant have Stripe Connect set up?
  // Required for any service that needs a deposit or has a no-show fee.
  const { data: merchantPaymentInfo } = useQuery({
    queryKey: ["merchant-payment-info", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("stripe_account_id")
        .eq("id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const merchantAcceptsCards = !!merchantPaymentInfo?.stripe_account_id;

 // Fetch existing bookings for the selected date
 const { data: existingBookings = [] } = useQuery({
 queryKey: ["date-bookings", merchantId, selectedDate?.toISOString()],
 queryFn: async () => {
 if (!selectedDate) return [];
 const dateStr = format(selectedDate,"yyyy-MM-dd");
 const { data, error } = await supabase
 .from("service_bookings")
 .select("start_time, end_time, service_id")
 .eq("merchant_id", merchantId)
 .eq("booking_date", dateStr)
 .neq("status","cancelled");
 if (error) throw error;
 return data || [];
 },
 enabled: !!selectedDate,
 });

 const selectedServiceData = services.find((s) => s.id === selectedService);
 const isGroomingService = selectedServiceData?.category ==="grooming";
 const isMobileService = (selectedServiceData as any)?.is_mobile_service === true;
 const effectiveDuration = isGroomingService && groomingData.adjustedDuration ? groomingData.adjustedDuration : selectedServiceData?.duration_minutes || 0;
 const effectivePrice = isGroomingService && groomingData.adjustedPrice ? Number(groomingData.adjustedPrice) : selectedServiceData?.price || 0;

 // Calculate available time slots for selected date
 const availableSlots = useMemo(() => {
 if (!selectedDate || !selectedServiceData) return [];

 const dayOfWeek = selectedDate.getDay();
 const dateStr = format(selectedDate,"yyyy-MM-dd");
 
 // Check for override on this date
 const override = overrides.find((o) => o.override_date === dateStr);
 if (override && !override.is_available) return [];

 // Get regular availability for this day
 const dayAvailability = availability.filter((a) => a.day_of_week === dayOfWeek && a.is_active);
 if (dayAvailability.length === 0 && !override?.is_available) return [];

 const slots: string[] = [];
 const serviceDuration = selectedServiceData.duration_minutes;

 // Generate slots based on availability
 (override?.is_available ? [{ 
 start_time: override.start_time!, 
 end_time: override.end_time!, 
 slot_duration_minutes: 30 
 }] : dayAvailability).forEach((avail) => {
 const [startHour, startMin] = avail.start_time.split(":").map(Number);
 const [endHour, endMin] = avail.end_time.split(":").map(Number);
 
 let currentMinutes = startHour * 60 + startMin;
 const endMinutes = endHour * 60 + endMin;

 while (currentMinutes + serviceDuration <= endMinutes) {
 const slotStart = `${Math.floor(currentMinutes / 60).toString().padStart(2,"0")}:${(currentMinutes % 60).toString().padStart(2,"0")}`;
 const slotEndMinutes = currentMinutes + serviceDuration;
 const slotEnd = `${Math.floor(slotEndMinutes / 60).toString().padStart(2,"0")}:${(slotEndMinutes % 60).toString().padStart(2,"0")}`;
 
 // Check if slot conflicts with existing bookings (including buffer)
 const bufferMins = selectedServiceData.buffer_minutes || 0;
 const hasConflict = existingBookings.some((booking) => {
 const bookingStart = booking.start_time;
 const bookingEnd = booking.end_time;
 // Add buffer: booking effectively occupies [start, end + buffer]
 const [bEndH, bEndM] = bookingEnd.split(":").map(Number);
 const bufferedEndMins = bEndH * 60 + bEndM + bufferMins;
 const bufferedEnd = `${Math.floor(bufferedEndMins / 60).toString().padStart(2,"0")}:${(bufferedEndMins % 60).toString().padStart(2,"0")}`;
 return (slotStart < bufferedEnd && slotEnd > bookingStart);
 });

 // Check minimum notice period
 const minNotice = selectedServiceData.min_notice_hours || 2;
 const now = new Date();
 const slotDateTime = new Date(`${format(selectedDate,"yyyy-MM-dd")}T${slotStart}:00`);
 const tooSoon = slotDateTime.getTime() - now.getTime() < minNotice * 60 * 60 * 1000;

 if (!hasConflict && !tooSoon) {
 slots.push(slotStart);
 }

 currentMinutes += avail.slot_duration_minutes || 30;
 }
 });

 return slots;
 }, [selectedDate, selectedServiceData, availability, overrides, existingBookings]);

 // Check if a date has availability
 const isDateAvailable = (date: Date) => {
 const dayOfWeek = date.getDay();
 const dateStr = format(date,"yyyy-MM-dd");
 
 // Check override
 const override = overrides.find((o) => o.override_date === dateStr);
 if (override) return override.is_available;

 // Check regular availability
 return availability.some((a) => a.day_of_week === dayOfWeek && a.is_active);
 };

 // Create booking mutation
 const createBooking = useMutation({
 mutationFn: async () => {
 if (!user || !selectedService || !selectedDate || !selectedSlot || !selectedServiceData) {
 throw new Error("Missing booking information");
 }

 // Fetch user profile for customer info
 const { data: profile } = await supabase
 .from("profiles")
 .select("full_name, phone")
 .eq("id", user.id)
 .single();

 const bookingDuration = isGroomingService && groomingData.adjustedDuration ? groomingData.adjustedDuration : selectedServiceData.duration_minutes;
 const bookingPrice = isGroomingService && groomingData.adjustedPrice ? Number(groomingData.adjustedPrice) : selectedServiceData.price;

 const slotEndMinutes = 
 parseInt(selectedSlot.split(":")[0]) * 60 + 
 parseInt(selectedSlot.split(":")[1]) + 
 bookingDuration;
 const endTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2,"0")}:${(slotEndMinutes % 60).toString().padStart(2,"0")}:00`;

 const bookingData: any = {
 merchant_id: merchantId,
 service_id: selectedService,
 user_id: user.id,
 pet_id: groomingData.petId || undefined,
 booking_date: format(selectedDate,"yyyy-MM-dd"),
 start_time: `${selectedSlot}:00`,
 end_time: endTime,
 status:"pending" as const,
 payment_status: selectedServiceData.payment_type ==="pay_at_service" ?"pending" :"pending",
 total_price: bookingPrice,
 notes: isGroomingService && groomingData.specialInstructions
 ? [notes, groomingData.specialInstructions].filter(Boolean).join(" |")
 : notes || undefined,
 customer_name: profile?.full_name || undefined,
 customer_phone: profile?.phone || undefined,
 customer_email: user.email || undefined,
 };

 // Attach service address for mobile services
 if (isMobileService && serviceAddress) {
 bookingData.service_address = serviceAddress;
 // Geocode the address for route optimization
 try {
 const { data: geocode } = await supabase.functions.invoke("geocode-address", {
 body: { address: serviceAddress },
 });
 if (geocode?.latitude) {
 bookingData.service_latitude = geocode.latitude;
 bookingData.service_longitude = geocode.longitude;
 }
 } catch (e) {
 console.error("Failed to geocode service address:", e);
 }
 }

 // Attach saved payment method if deposit was collected
 if (savedPaymentMethodId) {
 bookingData.stripe_payment_method_id = savedPaymentMethodId;
 bookingData.stripe_setup_intent_id = savedSetupIntentId;
 bookingData.deposit_amount = (selectedServiceData as any).deposit_amount || 0;
 bookingData.deposit_status ="collected";
 }

 const booking = await schedulingService.createBooking(bookingData);

 // Save grooming pet details if applicable
 if (isGroomingService && groomingData.petId && booking?.id) {
 await supabase.from("grooming_pet_details").insert({
 booking_id: booking.id,
 pet_id: groomingData.petId,
 breed: groomingData.breed || null,
 weight_lbs: groomingData.weightLbs ? parseFloat(groomingData.weightLbs) : null,
 coat_type: groomingData.coatType || null,
 coat_condition: groomingData.coatCondition,
 temperament_notes: groomingData.temperamentNotes || null,
 special_instructions: groomingData.specialInstructions || null,
 vaccine_status: groomingData.vaccineStatus,
 adjusted_duration_minutes: groomingData.adjustedDuration,
 adjusted_price: groomingData.adjustedPrice,
 }).then(({ error }) => {
 if (error) console.error("Failed to save grooming details:", error);
 });
 }

 return booking;
 },
 onSuccess: () => {
 toast.success("Booking request submitted!", {
 description: `${merchantName} will review and confirm your appointment shortly.`,
 });
 queryClient.invalidateQueries({ queryKey: ["date-bookings"] });

 // Send confirmation email (fire-and-forget)
 if (user?.email && selectedDate && selectedSlot && selectedServiceData) {
 const slotEndMinutes =
 parseInt(selectedSlot.split(":")[0]) * 60 +
 parseInt(selectedSlot.split(":")[1]) +
 selectedServiceData.duration_minutes;
 const endTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2,"0")}:${(slotEndMinutes % 60).toString().padStart(2,"0")}:00`;

 supabase.functions.invoke("send-booking-emails", {
 body: {
 type:"confirmation",
 customerEmail: user.email,
 customerName: user.user_metadata?.full_name || user.email,
 merchantName,
 serviceName: selectedServiceData.name,
 bookingDate: format(selectedDate,"yyyy-MM-dd"),
 startTime: `${selectedSlot}:00`,
 endTime,
 totalPrice: selectedServiceData.price,
 notes: notes || undefined,
 },
 }).catch((err) => console.error("Failed to send confirmation email:", err));
 }

 // Notify merchant of new booking request (fire-and-forget)
 if (selectedDate && selectedSlot && selectedServiceData) {
 // Get merchant owner user_id to send notification
 supabase
 .from("merchants")
 .select("user_id")
 .eq("id", merchantId)
 .single()
 .then(({ data: merchantData }) => {
 if (merchantData?.user_id) {
 supabase.from("notifications").insert({
 user_id: merchantData.user_id,
 title:"📋 New Booking Request",
 message: `${user?.user_metadata?.full_name || user?.email ||"A customer"} requested ${selectedServiceData.name} on ${format(selectedDate,"MMM d")} at ${selectedSlot.slice(0, 5)}.`,
 category:"transactional",
 is_read: false,
 }).then(({ error }) => {
 if (error) console.error("Failed to notify merchant:", error);
 });
 }
 });
 }

 // Reset form
 setSelectedService(null);
 setSelectedDate(undefined);
 setSelectedSlot(null);
 setNotes("");
 setStep("service");
 setGroomingData(createDefaultGroomingData());
 setSavedPaymentMethodId(null);
 setSavedSetupIntentId(null);
 },
 onError: (error) => {
 toast.error("Failed to create booking", {
 description: error instanceof Error ? error.message :"Please try again",
 });
 },
 });

 const formatTime = (time: string) => {
 const [hours, minutes] = time.split(":").map(Number);
 const period = hours >= 12 ?"PM" :"AM";
 const displayHours = hours % 12 || 12;
 return `${displayHours}:${minutes.toString().padStart(2,"0")} ${period}`;
 };

 // Helper function to format duration based on category
 const formatDuration = (minutes: number, category: string): string => {
 if (category ==='boarding') {
 const nights = Math.round(minutes / 1440);
 return nights === 1 ?'1 night' : `${nights} nights`;
 }
 if (category ==='daycare') {
 if (minutes <= 360) return'Half Day (up to 6 hours)';
 if (minutes <= 720) return'Full Day (up to 12 hours)';
 return `${Math.round(minutes / 60)} hours`;
 }
 // Standard format for other categories
 if (minutes >= 60) {
 const hours = Math.floor(minutes / 60);
 const remainingMins = minutes % 60;
 return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours} hour${hours > 1 ?'s' :''}`;
 }
 return `${minutes} minutes`;
 };

 if (servicesLoading) {
 return (
 <Card>
 <CardHeader>
 <Skeleton className="h-6 w-48" />
 <Skeleton className="h-4 w-64 mt-2" />
 </CardHeader>
 <CardContent className="space-y-4">
 <Skeleton className="h-24 w-full" />
 <Skeleton className="h-24 w-full" />
 </CardContent>
 </Card>
 );
 }

 if (services.length === 0) {
 return null; // Don't show widget if no services
 }

 return (
 <Card className="overflow-hidden">
 <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
 <CalendarIcon className="w-5 h-5 text-primary" />
 </div>
 <div>
 <CardTitle>Book an Appointment</CardTitle>
 <CardDescription>Schedule a service with {merchantName}</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="pt-6">
 {/* Progress Steps */}
 <div className="flex items-center justify-between mb-6">
 {["service","date","time","confirm"].map((s, i) => (
 <div key={s} className="flex items-center">
 <div
 className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
 step === s
 ?"bg-primary text-primary-foreground"
 : ["service","date","time","confirm"].indexOf(step) > i
 ?"bg-primary/20 text-primary"
 :"bg-muted text-muted-foreground"
 }`}
 >
 {["service","date","time","confirm"].indexOf(step) > i ? (
 <CheckCircle2 className="w-4 h-4" />
 ) : (
 i + 1
 )}
 </div>
 {i < 3 && (
 <div
 className={`w-8 md:w-12 h-0.5 mx-1 ${
 ["service","date","time","confirm"].indexOf(step) > i
 ?"bg-primary"
 :"bg-muted"
 }`}
 />
 )}
 </div>
 ))}
 </div>

 {/* Step 1: Select Service */}
 {step ==="service" && (
 <div className="space-y-3">
 <h3 className="font-medium text-sm text-muted-foreground mb-4">Select a Service</h3>
 {services.map((service) => {
 const hasFlashSale = isFlashSaleActive(service);
 const regularPB = calculateRegularPawbucksPrice(service.price);
 const savingsPercent = calculateFlashSaleSavings(service);
 
 return (
 <button
 key={service.id}
 onClick={() => {
 setSelectedService(service.id);
 setStep("date");
 }}
 className={`w-full p-4 rounded-md border text-left transition-all hover:border-primary hover:bg-primary/5 ${
 selectedService === service.id ?"border-primary bg-primary/5" :"border-border"
 } ${hasFlashSale ?"ring-2 ring-warning/30" :""}`}
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <h4 className="font-semibold">{service.name}</h4>
 <Badge variant="secondary" className="text-xs capitalize">
 {service.category.replace(/_/g," ")}
 </Badge>
 {(service as any).is_mobile_service && (
 <Badge variant="outline" className="text-xs gap-0.5">
 <span className="w-3 h-3" aria-hidden="true">📍</span>
 Mobile
 </Badge>
 )}
 {hasFlashSale && (
 <Badge className="bg-gradient-to-r from-warning to-warning text-white border-0 text-xs gap-0.5">
 <span className="w-3 h-3" aria-hidden="true">⚡</span>
 Flash Sale
 </Badge>
 )}
 </div>
 {service.description && (
 <p className="text-sm text-muted-foreground line-clamp-2">
 {service.description}
 </p>
 )}
 <div className="flex items-center gap-4 mt-2 text-sm">
 <span className="flex items-center gap-1 text-muted-foreground">
 <Timer className="w-3.5 h-3.5" />
 {formatDuration(service.duration_minutes, service.category)}
 </span>
 {service.max_capacity > 1 && (
 <span className="flex items-center gap-1 text-muted-foreground">
 <span className="w-3.5 h-3.5" aria-hidden="true">👥</span>
 Up to {service.max_capacity}
 </span>
 )}
 </div>
 </div>
 <div className="text-right flex-shrink-0">
 <div className="text-lg font-bold text-primary">
 {Formatters.currency(service.price)}
 </div>
 
 {/* Flash Sale PawBucks Pricing */}
 {hasFlashSale && service.flash_sale_pawbucks_price ? (
 <div className="mt-1 space-y-0.5">
 <div className="flex items-baseline gap-1 justify-end">
 <span className="text-xs text-muted-foreground line-through">
 {regularPB.toLocaleString()} PB
 </span>
 </div>
 <div className="text-success font-bold">
 {service.flash_sale_pawbucks_price.toLocaleString()} PB
 </div>
 <div className="text-xs text-success font-semibold">
 {savingsPercent}% Off!
 </div>
 {service.flash_sale_end_at && (
 <FlashSaleCountdown endAt={service.flash_sale_end_at} />
 )}
 </div>
 ) : cashbackRate > 0 && (
 <div className="flex items-center gap-1 text-xs text-warning mt-1">
 <Sparkles className="w-3 h-3" />
 +{Math.floor(service.price * cashbackRate)} PB
 </div>
 )}
 </div>
 </div>
 </button>
 );
 })}
 </div>
 )}

 {/* Step 2: Select Date */}
 {step ==="date" && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="font-medium text-sm text-muted-foreground">Select a Date</h3>
 <Button variant="ghost" size="sm" onClick={() => setStep("service")}>
 Change Service
 </Button>
 </div>
 <div className="flex justify-center">
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={(date) => {
 setSelectedDate(date);
 if (date) setStep("time");
 }}
 disabled={(date) => 
 !isAfter(date, startOfDay(new Date())) || 
 isAfter(date, addDays(new Date(), 60)) ||
 !isDateAvailable(date)
 }
 className="rounded-md border"
 />
 </div>
 </div>
 )}

 {/* Step 3: Select Time */}
 {step ==="time" && selectedDate && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="font-medium text-sm text-muted-foreground">Select a Time</h3>
 <p className="text-sm font-medium">{format(selectedDate,"EEEE, MMMM d, yyyy")}</p>
 </div>
 <Button variant="ghost" size="sm" onClick={() => setStep("date")}>
 Change Date
 </Button>
 </div>
 
 {availableSlots.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground space-y-3">
 <span className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true">⏰</span>
 <p>No available slots for this date.</p>
 <Button variant="link" onClick={() => setStep("date")}>
 Select another date
 </Button>
 </div>
 ) : (
 <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
 {availableSlots.map((slot) => (
 <Button
 key={slot}
 variant={selectedSlot === slot ?"default" :"outline"}
 size="sm"
 onClick={() => {
 setSelectedSlot(slot);
 setStep("confirm");
 }}
 className="text-sm"
 >
 {formatTime(slot)}
 </Button>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Step 4: Confirm */}
 {step ==="confirm" && selectedServiceData && selectedDate && selectedSlot && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="font-medium text-sm text-muted-foreground">Review & Submit</h3>
 <Button variant="ghost" size="sm" onClick={() => setStep("time")}>
 Change Time
 </Button>
 </div>

 {/* Summary */}
 <div className="p-4 rounded-md bg-muted space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground">Service</span>
 <span className="font-medium">{selectedServiceData.name}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground">Date</span>
 <span className="font-medium">{format(selectedDate,"MMM d, yyyy")}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground">Time</span>
 <span className="font-medium">{formatTime(selectedSlot)}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground">Duration</span>
 <span className="font-medium">{formatDuration(effectiveDuration, selectedServiceData.category)}</span>
 </div>
 <div className="border-t pt-3 flex items-center justify-between">
 <span className="font-medium">Total</span>
 <div className="text-right">
 <span className="text-xl font-bold text-primary">
 {Formatters.currency(effectivePrice)}
 </span>
 {selectedServiceData.payment_type ==="pay_at_booking" && (
 <p className="text-xs text-muted-foreground">Due at booking</p>
 )}
 {selectedServiceData.payment_type ==="pay_at_service" && (
 <p className="text-xs text-muted-foreground">Pay at service</p>
 )}
 </div>
 </div>
 </div>

 {/* Pending approval notice */}
 <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
 <span className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" aria-hidden="true">⏰</span>
 <p className="text-warning">
 Your booking will be submitted as a <strong>request</strong>. {merchantName} will review and confirm it fits their schedule and location.
 </p>
 </div>

 {/* Grooming Pet Selector - only for grooming services */}
 {isGroomingService && (
 <GroomingPetSelector
 merchantId={merchantId}
 baseDuration={selectedServiceData.duration_minutes}
 basePrice={selectedServiceData.price}
 groomingData={groomingData}
 onGroomingDataChange={setGroomingData}
 />
 )}

 {/* Mobile Service Address */}
 {isMobileService && (
 <div className="space-y-2">
 <Label htmlFor="service-address" className="flex items-center gap-1.5">
 <span className="w-3.5 h-3.5" aria-hidden="true">📍</span>
 Your Address (Required)
 </Label>
 <Input
 id="service-address"
 placeholder="Enter the address where you'd like the service..."
 value={serviceAddress}
 onChange={(e) => setServiceAddress(e.target.value)}
 />
 <p className="text-xs text-muted-foreground">
 The provider will travel to this location
 </p>
 </div>
 )}

 {/* Notes */}
 <div className="space-y-2">
 <Label htmlFor="notes">Special Requests (Optional)</Label>
 <Textarea
 id="notes"
 placeholder="Any special instructions or requests..."
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={2}
 />
 </div>

 {/* Deposit Notice */}
 {(selectedServiceData as any).require_deposit && (
            merchantAcceptsCards ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20 text-sm">
                <span className="w-4 h-4 text-info mt-0.5 flex-shrink-0" aria-hidden="true">💳</span>
                <p className="text-info">
                  This service requires a <strong>card on file</strong> to book.
                  {(selectedServiceData as any).no_show_fee_amount > 0 && (
                    <> A {Formatters.currency(Number((selectedServiceData as any).no_show_fee_amount))} no-show fee applies if you miss your appointment.</>
                  )}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                <span className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" aria-hidden="true">🚫</span>
                <p className="text-destructive">
                  <strong>This service can't be booked online yet.</strong> {merchantName} hasn't finished setting up payment processing,
                  so we can't securely save a card on file. Please contact them directly to book.
                </p>
              </div>
            )
 )}

 {/* Book Button */}
 {user ? (
 <Button
 className="w-full"
 size="lg"
 onClick={() => {
 if ((selectedServiceData as any).require_deposit && !savedPaymentMethodId) {
 setStep("deposit");
 } else {
 createBooking.mutate();
 }
 }}
              disabled={
                createBooking.isPending ||
                (isGroomingService && groomingData.hasBlockingVaccineIssue) ||
                (isMobileService && !serviceAddress.trim()) ||
                ((selectedServiceData as any).require_deposit && !merchantAcceptsCards)
              }
 >
 {createBooking.isPending ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Booking...
 </>
 ) : (selectedServiceData as any).require_deposit && !savedPaymentMethodId ? (
 <>
 Continue to Card Setup
 <ArrowRight className="w-4 h-4 ml-2" />
 </>
 ) : (
 <>
 Submit Booking Request
 <ArrowRight className="w-4 h-4 ml-2" />
 </>
 )}
 </Button>
 ) : (
 <Button
 className="w-full"
 size="lg"
 onClick={() => navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`)}
 >
 Sign in to Book
 <ArrowRight className="w-4 h-4 ml-2" />
 </Button>
 )}
 </div>
 )}

 {/* Step 5: Deposit Card Collection */}
 {step ==="deposit" && selectedServiceData && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="font-medium text-sm text-muted-foreground">Save Card on File</h3>
 <Button variant="ghost" size="sm" onClick={() => setStep("confirm")}>
 Back
 </Button>
 </div>
 <DepositCardForm
 merchantId={merchantId}
 serviceId={selectedServiceData.id}
 depositAmount={(selectedServiceData as any).deposit_amount || 0}
 noShowFeeAmount={(selectedServiceData as any).no_show_fee_amount || 0}
 onCardSaved={(paymentMethodId, setupIntentId) => {
 setSavedPaymentMethodId(paymentMethodId);
 setSavedSetupIntentId(setupIntentId);
 // Immediately submit the booking
 createBooking.mutate();
 }}
 onCancel={() => setStep("confirm")}
 />
 </div>
 )}
 </CardContent>
 </Card>
 );
};
