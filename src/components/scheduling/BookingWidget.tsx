import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { schedulingService } from "@/services/api/scheduling.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSameDay, parseISO, isAfter, startOfDay } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  DollarSign, 
  Loader2, 
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Timer,
  Users
} from "lucide-react";

type Props = {
  merchantId: string;
  merchantName: string;
  cashbackRate?: number;
};

export const BookingWidget = ({ merchantId, merchantName, cashbackRate = 10 }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"service" | "date" | "time" | "confirm">("service");

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

  // Fetch existing bookings for the selected date
  const { data: existingBookings = [] } = useQuery({
    queryKey: ["date-bookings", merchantId, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedDate) return [];
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("service_bookings")
        .select("start_time, end_time, service_id")
        .eq("merchant_id", merchantId)
        .eq("booking_date", dateStr)
        .neq("status", "cancelled");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDate,
  });

  const selectedServiceData = services.find((s) => s.id === selectedService);

  // Calculate available time slots for selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate || !selectedServiceData) return [];

    const dayOfWeek = selectedDate.getDay();
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
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
        const slotStart = `${Math.floor(currentMinutes / 60).toString().padStart(2, "0")}:${(currentMinutes % 60).toString().padStart(2, "0")}`;
        const slotEndMinutes = currentMinutes + serviceDuration;
        const slotEnd = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, "0")}:${(slotEndMinutes % 60).toString().padStart(2, "0")}`;
        
        // Check if slot conflicts with existing bookings
        const hasConflict = existingBookings.some((booking) => {
          const bookingStart = booking.start_time;
          const bookingEnd = booking.end_time;
          return (slotStart < bookingEnd && slotEnd > bookingStart);
        });

        if (!hasConflict) {
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
    const dateStr = format(date, "yyyy-MM-dd");
    
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

      const slotEndMinutes = 
        parseInt(selectedSlot.split(":")[0]) * 60 + 
        parseInt(selectedSlot.split(":")[1]) + 
        selectedServiceData.duration_minutes;
      const endTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, "0")}:${(slotEndMinutes % 60).toString().padStart(2, "0")}:00`;

      const bookingData = {
        merchant_id: merchantId,
        service_id: selectedService,
        user_id: user.id,
        booking_date: format(selectedDate, "yyyy-MM-dd"),
        start_time: `${selectedSlot}:00`,
        end_time: endTime,
        status: "pending" as const,
        payment_status: selectedServiceData.payment_type === "pay_at_service" ? "pending" : "pending",
        total_price: selectedServiceData.price,
        notes: notes || undefined,
        customer_name: profile?.full_name || undefined,
        customer_phone: profile?.phone || undefined,
        customer_email: user.email || undefined,
      };

      return schedulingService.createBooking(bookingData);
    },
    onSuccess: () => {
      toast.success("Booking confirmed!", {
        description: `Your appointment at ${merchantName} has been scheduled.`,
      });
      queryClient.invalidateQueries({ queryKey: ["date-bookings"] });
      // Reset form
      setSelectedService(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
      setNotes("");
      setStep("service");
    },
    onError: (error) => {
      toast.error("Failed to create booking", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    },
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  // Helper function to format duration based on category
  const formatDuration = (minutes: number, category: string): string => {
    if (category === 'boarding') {
      const nights = Math.round(minutes / 1440);
      return nights === 1 ? '1 night' : `${nights} nights`;
    }
    if (category === 'daycare') {
      if (minutes <= 360) return 'Half Day (up to 6 hours)';
      if (minutes <= 720) return 'Full Day (up to 12 hours)';
      return `${Math.round(minutes / 60)} hours`;
    }
    // Standard format for other categories
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
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
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
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
          {["service", "date", "time", "confirm"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["service", "date", "time", "confirm"].indexOf(step) > i
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {["service", "date", "time", "confirm"].indexOf(step) > i ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div
                  className={`w-8 md:w-12 h-0.5 mx-1 ${
                    ["service", "date", "time", "confirm"].indexOf(step) > i
                      ? "bg-primary/50"
                      : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select Service */}
        {step === "service" && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground mb-4">Select a Service</h3>
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => {
                  setSelectedService(service.id);
                  setStep("date");
                }}
                className={`w-full p-4 rounded-xl border text-left transition-all hover:border-primary/50 hover:bg-primary/5 ${
                  selectedService === service.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{service.name}</h4>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {service.category.replace(/_/g, " ")}
                      </Badge>
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
                          <Users className="w-3.5 h-3.5" />
                          Up to {service.max_capacity}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-primary">
                      ${service.price.toFixed(2)}
                    </div>
                    {cashbackRate > 0 && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <Sparkles className="w-3 h-3" />
                        +{Math.floor(service.price * cashbackRate)} PB
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Select Date */}
        {step === "date" && (
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
        {step === "time" && selectedDate && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Select a Time</h3>
                <p className="text-sm font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep("date")}>
                Change Date
              </Button>
            </div>
            
            {availableSlots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
                    variant={selectedSlot === slot ? "default" : "outline"}
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
        {step === "confirm" && selectedServiceData && selectedDate && selectedSlot && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm text-muted-foreground">Confirm Booking</h3>
              <Button variant="ghost" size="sm" onClick={() => setStep("time")}>
                Change Time
              </Button>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-xl bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium">{selectedServiceData.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{format(selectedDate, "MMM d, yyyy")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{formatTime(selectedSlot)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{formatDuration(selectedServiceData.duration_minutes, selectedServiceData.category)}</span>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="font-medium">Total</span>
                <div className="text-right">
                  <span className="text-xl font-bold text-primary">
                    ${selectedServiceData.price.toFixed(2)}
                  </span>
                  {selectedServiceData.payment_type === "pay_at_booking" && (
                    <p className="text-xs text-muted-foreground">Due at booking</p>
                  )}
                  {selectedServiceData.payment_type === "pay_at_service" && (
                    <p className="text-xs text-muted-foreground">Pay at service</p>
                  )}
                </div>
              </div>
            </div>

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

            {/* Book Button */}
            {user ? (
              <Button
                className="w-full"
                size="lg"
                onClick={() => createBooking.mutate()}
                disabled={createBooking.isPending}
              >
                {createBooking.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    Confirm Booking
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate("/auth")}
              >
                Sign in to Book
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
