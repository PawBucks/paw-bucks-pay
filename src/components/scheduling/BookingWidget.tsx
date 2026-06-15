import { useState, useMemo, useEffect, useRef } from "react";
import { GroomingPetSelector, createDefaultGroomingData, type GroomingPetData } from "./GroomingPetSelector";
import { DepositCardForm } from "./DepositCardForm";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  schedulingService,
  isFlashSaleActive,
  calculateRegularPawbucksPrice,
  calculateFlashSaleSavings,
} from "@/services/api/scheduling.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isAfter, startOfDay } from "date-fns";
import { AlertCircle, ArrowRight, Ban, Calendar as CalendarIcon, CheckCircle2, Clock, CreditCard, Loader2, MapPin, Timer, Users, Zap } from "lucide-react";
import { PawBucksIcon } from "@/components/PawBucksIcon";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { PawBucksLogo } from "@/components/PawBucksLogo";
import { Formatters } from "@/utils/formatters";
import { useSpendablePawBucks } from "@/hooks/useSpendablePawBucks";
import { useSubscription } from "@/hooks/useSubscription";
import {
  DEFAULT_MERCHANT_TZ,
  getViewerTimeZone,
  merchantWallClockToInstant,
  viewerLocalTimeFor,
  tzAbbr,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

// ── Earn multiplier per tier (PB earned per $1 spent) ────────────────────────
const TIER_MULTIPLIER: Record<string, number> = {
  Free: 10,
  PawPass: 20,
  "PawPass+": 30,
};
function tierMultiplier(tier?: string | null): number {
  if (!tier) return 10;
  if (tier in TIER_MULTIPLIER) return TIER_MULTIPLIER[tier];
  const t = tier.toLowerCase();
  if (t.includes("pawpass+") || t.includes("plus")) return 30;
  if (t.includes("pawpass")) return 20;
  return 10;
}

// ── Flash Sale Countdown ─────────────────────────────────────────────────────
function FlashSaleCountdown({ endAt }: { endAt: string }) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  useEffect(() => {
    const update = () => {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) return setTimeRemaining("Ended");
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (hours > 24) setTimeRemaining(`Ends in ${Math.floor(hours / 24)}d ${hours % 24}h`);
      else if (hours > 0) setTimeRemaining(`Ends in ${hours}h ${minutes}m`);
      else setTimeRemaining(`Ends in ${minutes}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [endAt]);
  if (!timeRemaining) return null;
  return (
    <div className="flex items-center gap-1 text-warning text-xs justify-end">
      <Timer className="w-3 h-3" />
      <span>{timeRemaining}</span>
    </div>
  );
}

// ── Step indicator ───────────────────────────────────────────────────────────
const STEP_LABELS = ["Service", "Date", "Time", "Review"];
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center pb-5 pt-1">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={label} className={cn("flex items-center", i < STEP_LABELS.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                  done || active
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-muted border-border text-muted-foreground",
                )}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : n}
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap",
                  active ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn("flex-1 h-0.5 mx-1 mb-5 transition-colors", done ? "bg-primary" : "bg-border")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  merchantId: string;
  merchantName: string;
  cashbackRate?: number;
  preselectedPetId?: string | null;
};

export const BookingWidget = ({ merchantId, merchantName, cashbackRate = 10, preselectedPetId = null }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { subscription } = useSubscription();
  const userTier = subscription.subscription_tier;
  const earnMultiplier = tierMultiplier(userTier);

  const { spendableBalance } = useSpendablePawBucks(user?.id);

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1); // 5 = deposit
  const [done, setDone] = useState(false);
  const [groomingData, setGroomingData] = useState<GroomingPetData>(() => ({
    ...createDefaultGroomingData(),
    petId: preselectedPetId || null,
  }));

  // Sync preselected pet if it changes after mount (e.g. URL param updates).
  useEffect(() => {
    if (preselectedPetId && groomingData.petId !== preselectedPetId) {
      setGroomingData((prev) => ({ ...prev, petId: preselectedPetId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedPetId]);
  const [savedPaymentMethodId, setSavedPaymentMethodId] = useState<string | null>(null);
  const [savedSetupIntentId, setSavedSetupIntentId] = useState<string | null>(null);
  const [serviceAddress, setServiceAddress] = useState("");
  const [pbToApply, setPbToApply] = useState(0);
  const [pbInput, setPbInput] = useState("");
  const pbUserOverrideRef = useRef(false);

  // Load user's auto-redeem preference (mirrors InvoicePayment / Storefront behavior).
  // Default to "always" so PawBucks are auto-applied unless the user explicitly opted out.
  const { data: autoRedeemPrefs } = useQuery({
    queryKey: ["auto-redeem-prefs", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["merchant-services-active", merchantId],
    queryFn: () => schedulingService.getActiveServices(merchantId),
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["merchant-availability", merchantId],
    queryFn: () => schedulingService.getAvailability(merchantId),
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["merchant-overrides", merchantId],
    queryFn: () => schedulingService.getOverrides(merchantId),
  });

  const { data: merchantPaymentInfo } = useQuery({
    queryKey: ["merchant-payment-info", merchantId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "get_merchant_checkout_context",
        { p_merchant_id: merchantId }
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row
        ? {
            stripe_account_id: row.stripe_account_id,
            stripe_account_status: row.stripe_account_status,
            timezone: row.timezone,
          }
        : null;
    },
  });
  const merchantAcceptsCards =
    !!merchantPaymentInfo?.stripe_account_id &&
    merchantPaymentInfo?.stripe_account_status === "active";
  const merchantTz = merchantPaymentInfo?.timezone || DEFAULT_MERCHANT_TZ;
  const viewerTz = getViewerTimeZone();
  const showViewerLocal = viewerTz !== merchantTz;

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
  const isGroomingService = selectedServiceData?.category === "grooming";
  const isMobileService = (selectedServiceData as any)?.is_mobile_service === true;
  const effectiveDuration =
    isGroomingService && groomingData.adjustedDuration
      ? groomingData.adjustedDuration
      : selectedServiceData?.duration_minutes || 0;
  const effectivePrice =
    isGroomingService && groomingData.adjustedPrice
      ? Number(groomingData.adjustedPrice)
      : selectedServiceData?.price || 0;

  // PawBucks redemption math (1000 PB = $1)
  const maxPbApplicable = Math.min(spendableBalance, Math.round(effectivePrice * 1000));
  const pbDiscountUsd = pbToApply / 1000;
  const cashDue = Math.max(0, effectivePrice - pbDiscountUsd);
  const earnPb = Math.floor(cashDue * earnMultiplier);

  const handleApplyPb = () => {
    const dollars = parseFloat(pbInput || "0");
    if (!isFinite(dollars) || dollars <= 0) return;
    const raw = Math.round(dollars * 1000);
    pbUserOverrideRef.current = true;
    setPbToApply(Math.min(Math.max(0, raw), maxPbApplicable));
    setPbInput("");
  };

  // Auto-apply PawBucks based on user's auto-redeem preference (default: always max).
  // Mirrors the platform-wide behavior in InvoicePayment / Storefront / PetStore so
  // users don't have to hunt for a slider to spend the rewards they already earned.
  useEffect(() => {
    if (pbUserOverrideRef.current) return;
    if (!user || spendableBalance <= 0 || effectivePrice <= 0) return;
    const mode = (autoRedeemPrefs?.auto_redeem_mode as string) || "always";
    if (mode === "off") return;
    const PB_TO_USD = 0.001;
    const maxNeededPB = Math.floor(effectivePrice / PB_TO_USD);
    let apply = 0;
    if (mode === "always" || mode === "smart_max" || mode === "subscriptions_only") {
      apply = Math.min(spendableBalance, maxNeededPB);
    } else if (mode === "smart") {
      const minCoverage = autoRedeemPrefs?.auto_redeem_min_coverage_pct ?? 20;
      const maxApply = autoRedeemPrefs?.auto_redeem_max_apply_pct ?? 50;
      const coveragePct = ((spendableBalance * PB_TO_USD) / effectivePrice) * 100;
      if (coveragePct >= minCoverage) {
        const capPB = Math.floor(((effectivePrice * maxApply) / 100) / PB_TO_USD);
        apply = Math.min(spendableBalance, capPB, maxNeededPB);
      } else {
        apply = Math.min(spendableBalance, maxNeededPB);
      }
    } else {
      apply = Math.min(spendableBalance, maxNeededPB);
    }
    if (apply !== pbToApply) setPbToApply(apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, spendableBalance, effectivePrice, autoRedeemPrefs]);

  const availableSlots = useMemo(() => {
    if (!selectedDate || !selectedServiceData) return [];
    const dayOfWeek = selectedDate.getDay();
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const override = overrides.find((o) => o.override_date === dateStr);
    if (override && !override.is_available) return [];
    const dayAvailability = availability.filter((a) => a.day_of_week === dayOfWeek && a.is_active);
    if (dayAvailability.length === 0 && !override?.is_available) return [];

    const slots: string[] = [];
    const serviceDuration = selectedServiceData.duration_minutes;
    (override?.is_available
      ? [{ start_time: override.start_time!, end_time: override.end_time!, slot_duration_minutes: 30 }]
      : dayAvailability
    ).forEach((avail) => {
      const [sH, sM] = avail.start_time.split(":").map(Number);
      const [eH, eM] = avail.end_time.split(":").map(Number);
      let cur = sH * 60 + sM;
      const end = eH * 60 + eM;
      while (cur + serviceDuration <= end) {
        const slotStart = `${Math.floor(cur / 60).toString().padStart(2, "0")}:${(cur % 60)
          .toString()
          .padStart(2, "0")}`;
        const slotEndMin = cur + serviceDuration;
        const slotEnd = `${Math.floor(slotEndMin / 60).toString().padStart(2, "0")}:${(slotEndMin % 60)
          .toString()
          .padStart(2, "0")}`;
        const bufferMins = selectedServiceData.buffer_minutes || 0;
        const hasConflict = existingBookings.some((b) => {
          const [bEH, bEM] = b.end_time.split(":").map(Number);
          const bufEnd = `${Math.floor((bEH * 60 + bEM + bufferMins) / 60).toString().padStart(2, "0")}:${(
            (bEH * 60 + bEM + bufferMins) %
            60
          )
            .toString()
            .padStart(2, "0")}`;
          return slotStart < bufEnd && slotEnd > b.start_time;
        });
        const minNotice = selectedServiceData.min_notice_hours || 2;
        const slotDT = merchantWallClockToInstant(format(selectedDate, "yyyy-MM-dd"), slotStart, merchantTz);
        const tooSoon = slotDT.getTime() - Date.now() < minNotice * 3600000;
        if (!hasConflict && !tooSoon) slots.push(slotStart);
        cur += avail.slot_duration_minutes || 30;
      }
    });
    return slots;
  }, [selectedDate, selectedServiceData, availability, overrides, existingBookings, merchantTz]);

  const isDateAvailable = (date: Date) => {
    const dayOfWeek = date.getDay();
    const dateStr = format(date, "yyyy-MM-dd");
    const override = overrides.find((o) => o.override_date === dateStr);
    if (override) return override.is_available;
    return availability.some((a) => a.day_of_week === dayOfWeek && a.is_active);
  };

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!user || !selectedService || !selectedDate || !selectedSlot || !selectedServiceData) {
        throw new Error("Missing booking information");
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();

      const bookingDuration = effectiveDuration;
      const bookingPrice = effectivePrice;
      const slotEndMin = parseInt(selectedSlot.split(":")[0]) * 60 + parseInt(selectedSlot.split(":")[1]) + bookingDuration;
      const endTime = `${Math.floor(slotEndMin / 60).toString().padStart(2, "0")}:${(slotEndMin % 60).toString().padStart(2, "0")}:00`;

      const bookingData: any = {
        merchant_id: merchantId,
        service_id: selectedService,
        user_id: user.id,
        pet_id: groomingData.petId || undefined,
        booking_date: format(selectedDate, "yyyy-MM-dd"),
        start_time: `${selectedSlot}:00`,
        end_time: endTime,
        status: "pending" as const,
        payment_status: "pending",
        total_price: bookingPrice,
        pawbucks_applied: pbToApply,
        pawbucks_discount_usd: pbDiscountUsd,
        cash_due: cashDue,
        notes:
          isGroomingService && groomingData.specialInstructions
            ? [notes, groomingData.specialInstructions].filter(Boolean).join(" |")
            : notes || undefined,
        customer_name: profile?.full_name || undefined,
        customer_phone: profile?.phone || undefined,
        customer_email: user.email || undefined,
      };

      if (isMobileService && serviceAddress) {
        bookingData.service_address = serviceAddress;
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

      if (savedPaymentMethodId) {
        bookingData.stripe_payment_method_id = savedPaymentMethodId;
        bookingData.stripe_setup_intent_id = savedSetupIntentId;
        bookingData.deposit_amount = (selectedServiceData as any).deposit_amount || 0;
        bookingData.deposit_status = "collected";
      }

      const booking = await schedulingService.createBooking(bookingData);

      if (isGroomingService && groomingData.petId && booking?.id) {
        await supabase
          .from("grooming_pet_details")
          .insert({
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
          })
          .then(({ error }) => {
            if (error) console.error("Failed to save grooming details:", error);
          });
      }

      return booking;
    },
    onSuccess: (booking: any) => {
      queryClient.invalidateQueries({ queryKey: ["date-bookings"] });
      if (user?.email && selectedDate && selectedSlot && selectedServiceData) {
        const slotEndMin = parseInt(selectedSlot.split(":")[0]) * 60 + parseInt(selectedSlot.split(":")[1]) + selectedServiceData.duration_minutes;
        const endTime = `${Math.floor(slotEndMin / 60).toString().padStart(2, "0")}:${(slotEndMin % 60).toString().padStart(2, "0")}:00`;
        supabase.functions
          .invoke("send-booking-emails", {
            body: {
              type: "confirmation",
              bookingId: booking?.id,
              initiator: "customer",
              customerEmail: user.email,
              customerName: user.user_metadata?.full_name || user.email,
              merchantName,
              serviceName: selectedServiceData.name,
              bookingDate: format(selectedDate, "yyyy-MM-dd"),
              startTime: `${selectedSlot}:00`,
              endTime,
              totalPrice: selectedServiceData.price,
              notes: notes || undefined,
            },
          })
          .catch((err) => console.error("Failed to send confirmation email:", err));
      }
      setDone(true);
    },
    onError: (error) => {
      toast.error("Failed to create booking", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    },
  });

  const resetAll = () => {
    setSelectedService(null);
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setNotes("");
    setStep(1);
    setGroomingData(createDefaultGroomingData());
    setSavedPaymentMethodId(null);
    setSavedSetupIntentId(null);
    setServiceAddress("");
    setPbToApply(0);
    setPbInput("");
    setDone(false);
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
  };

  const formatDuration = (minutes: number, category: string): string => {
    if (category === "boarding") {
      const nights = Math.round(minutes / 1440);
      return nights === 1 ? "1 night" : `${nights} nights`;
    }
    if (category === "daycare") {
      if (minutes <= 360) return "Half Day (up to 6 hours)";
      if (minutes <= 720) return "Full Day (up to 12 hours)";
      return `${Math.round(minutes / 60)} hours`;
    }
    if (minutes >= 60) {
      const hrs = Math.floor(minutes / 60);
      const rem = minutes % 60;
      return rem > 0 ? `${hrs}h ${rem}m` : `${hrs} hour${hrs > 1 ? "s" : ""}`;
    }
    return `${minutes} minutes`;
  };

  // ── Loading / empty ────────────────────────────────────────────────────────
  if (servicesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (services.length === 0) return null;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (done && selectedServiceData && selectedDate && selectedSlot) {
    return (
      <div className="flex flex-col items-center text-center py-8 px-2">
        <div className="w-18 h-18 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-9 h-9 text-primary" />
        </div>
        <h3 className="text-xl font-extrabold mb-2">Booking Requested!</h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
          Your booking request has been sent to <strong className="text-foreground">{merchantName}</strong>.
          You&apos;ll be notified once they confirm.
        </p>

        <div className="w-full max-w-sm bg-card border border-border rounded-md p-4 mb-4">
          {[
            ["Service", selectedServiceData.name],
            ["Date", format(selectedDate, "MMM d, yyyy")],
            ["Time", `${formatTime(selectedSlot)} ${tzAbbr(selectedDate, merchantTz)}`],
            ...(pbToApply > 0 ? [["PawBucks applied", `-${pbToApply.toLocaleString()} PB`]] : []),
            ["Cash due", Formatters.currency(cashDue)],
          ].map(([k, v]) => (
            <div
              key={k as string}
              className="flex justify-between text-sm py-1.5 border-b border-border/50 last:border-0"
            >
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm bg-foreground text-background rounded-md px-4 py-3 flex items-center gap-3 mb-6">
          <PawBucksLogo className="w-6 h-6 text-primary" />
          <div className="text-left">
            <div className="text-sm font-semibold">+{earnPb.toLocaleString()} PawBucks incoming</div>
            <div className="text-xs opacity-70">Credited after your service is complete</div>
          </div>
        </div>

        <div className="flex gap-2 w-full max-w-sm">
          <Button variant="outline" className="flex-1" onClick={resetAll}>
            Book Another
          </Button>
          <Button className="flex-1" onClick={() => navigate("/my-bookings")}>
            My Bookings
          </Button>
        </div>
      </div>
    );
  }

  // ── Render header + step indicator ─────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
          <CalendarIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="font-bold text-base">Book an Appointment</div>
          <div className="text-xs text-muted-foreground">Schedule a service with {merchantName}</div>
        </div>
      </div>

      <StepIndicator current={step <= 4 ? step : 4} />

      {/* ── STEP 1: Service ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <div className="mb-4">
            <h3 className="text-base font-bold">Select a Service</h3>
            <p className="text-xs text-muted-foreground">Choose the service you&apos;d like to book</p>
          </div>
          <div className="space-y-2.5">
            {services.map((service) => {
              const hasFlash = isFlashSaleActive(service);
              const regularPB = calculateRegularPawbucksPrice(service.price);
              const savingsPercent = calculateFlashSaleSavings(service);
              const isSelected = selectedService === service.id;
              const svcEarn = Math.floor(service.price * earnMultiplier);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedService(service.id)}
                  className={cn(
                    "w-full text-left rounded-md border bg-card p-4 transition-all",
                    isSelected
                      ? "border-primary ring-2 ring-primary/15"
                      : "border-border hover:border-primary/40",
                    hasFlash && !isSelected && "ring-1 ring-warning/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-bold">{service.name}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {service.category.replace(/_/g, " ")}
                      </Badge>
                      {(service as any).is_mobile_service && (
                        <Badge variant="outline" className="text-[10px] gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          Mobile
                        </Badge>
                      )}
                      {hasFlash && (
                        <Badge className="bg-warning text-warning-foreground text-[10px] gap-0.5">
                          <Zap className="w-2.5 h-2.5" />
                          Flash Sale
                        </Badge>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-extrabold text-primary leading-none">
                        {Formatters.currency(service.price)}
                      </div>
                      {hasFlash && service.flash_sale_pawbucks_price ? (
                        <div className="mt-1 space-y-0.5">
                          <div className="text-[10px] text-muted-foreground line-through">
                            {regularPB.toLocaleString()} PB
                          </div>
                          <div className="text-success font-bold text-xs">
                            {service.flash_sale_pawbucks_price.toLocaleString()} PB
                          </div>
                          <div className="text-[10px] text-success font-semibold">{savingsPercent}% Off!</div>
                          {service.flash_sale_end_at && (
                            <FlashSaleCountdown endAt={service.flash_sale_end_at} />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-primary font-semibold mt-0.5 justify-end">
                          <Sparkles className="w-3 h-3" />
                          +{svcEarn.toLocaleString()} PB
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(service.duration_minutes, service.category)}
                    </span>
                    {service.max_capacity > 1 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Up to {service.max_capacity}
                      </span>
                    )}
                  </div>
                  {service.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {service.description}
                    </p>
                  )}
                  {isSelected && (
                    <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <Button className="w-full mt-5" disabled={!selectedService} onClick={() => setStep(2)}>
            Continue to Date <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* ── STEP 2: Date ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-bold">Select a Date</h3>
              <p className="text-xs text-muted-foreground">Choose your preferred appointment date</p>
            </div>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setStep(1)}>
              Change Service
            </Button>
          </div>
          <div className="flex justify-center rounded-md border border-border bg-card">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d);
                setSelectedSlot(null);
              }}
              disabled={(date) =>
                !isAfter(date, startOfDay(new Date())) ||
                isAfter(date, addDays(new Date(), 60)) ||
                !isDateAvailable(date)
              }
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
          <Button className="w-full mt-5" disabled={!selectedDate} onClick={() => setStep(3)}>
            Continue to Time <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* ── STEP 3: Time ─────────────────────────────────────────────────── */}
      {step === 3 && selectedDate && (
        <div>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-bold">Select a Time</h3>
              <p className="text-sm font-semibold mt-0.5">{format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Times shown in {tzAbbr(selectedDate, merchantTz)}
                {showViewerLocal && <> · your local time shown beneath each slot</>}
              </p>
            </div>
            <Button variant="link" size="sm" className="h-auto p-0 shrink-0" onClick={() => setStep(2)}>
              Change Date
            </Button>
          </div>
          {availableSlots.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No available slots for this date.</p>
              <Button variant="link" onClick={() => setStep(2)}>
                Pick another date
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableSlots.map((slot) => {
                const isSel = selectedSlot === slot;
                const localLabel = showViewerLocal
                  ? viewerLocalTimeFor(selectedDate, slot, merchantTz, viewerTz)
                  : null;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      "rounded-md border py-2.5 px-1 transition-all text-center",
                      isSel
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border hover:border-primary/40",
                    )}
                  >
                    <div className="text-sm font-bold leading-tight">{formatTime(slot)}</div>
                    {localLabel && (
                      <div
                        className={cn(
                          "text-[10px] mt-0.5",
                          isSel ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {localLabel} local
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <Button className="w-full mt-5" disabled={!selectedSlot} onClick={() => setStep(4)}>
            Continue to Review <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* ── STEP 4: Review & Submit ──────────────────────────────────────── */}
      {step === 4 && selectedServiceData && selectedDate && selectedSlot && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold">Review & Submit</h3>
              <p className="text-xs text-muted-foreground">Confirm your booking details</p>
            </div>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setStep(3)}>
              Change Time
            </Button>
          </div>

          {/* Summary card */}
          <div className="rounded-md border border-border bg-card overflow-hidden">
            {[
              ["Service", selectedServiceData.name],
              ["Date", format(selectedDate, "MMM d, yyyy")],
              [
                "Time",
                <span key="t">
                  {formatTime(selectedSlot)} {tzAbbr(selectedDate, merchantTz)}
                  {showViewerLocal && (
                    <>
                      <br />
                      <span className="text-[11px] text-muted-foreground">
                        {viewerLocalTimeFor(selectedDate, selectedSlot, merchantTz, viewerTz)} local
                      </span>
                    </>
                  )}
                </span>,
              ],
              ["Duration", formatDuration(effectiveDuration, selectedServiceData.category)],
            ].map(([k, v]) => (
              <div
                key={k as string}
                className="flex justify-between items-center px-4 py-3 border-b border-border/50 last:border-0 gap-3"
              >
                <span className="text-xs text-muted-foreground">{k}</span>
                <span className="text-sm font-medium text-right">{v}</span>
              </div>
            ))}
            <div className="px-4 py-3 bg-muted/40 border-t border-border/50 flex justify-between items-baseline">
              <span className="text-sm font-bold">Total</span>
              <div className="text-right">
                <div className="text-xl font-extrabold text-primary leading-none">
                  {Formatters.currency(cashDue)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {selectedServiceData.payment_type === "pay_at_booking" ? "Due at booking" : "Due at service"}
                </div>
              </div>
            </div>
          </div>

          {/* PawBucks redemption */}
          {user && spendableBalance > 0 && (
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <PawBucksLogo className="w-4 h-4 text-primary" />
                  Apply PawBucks
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Balance:{" "}
                  <strong className="text-primary">
                    {Formatters.currency(spendableBalance / 1000)}
                  </strong>
                </div>
              </div>
              {pbToApply > 0 ? (
                <div className="bg-primary/10 border border-primary/20 rounded px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-primary font-medium">
                    -{pbToApply.toLocaleString()} PB applied (-{Formatters.currency(pbDiscountUsd)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      pbUserOverrideRef.current = true;
                      setPbToApply(0);
                    }}
                    className="text-xs text-destructive font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={`Max $${(maxPbApplicable / 1000).toFixed(2)}`}
                    value={pbInput}
                    onChange={(e) => setPbInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyPb())}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleApplyPb}>
                    Apply
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      pbUserOverrideRef.current = true;
                      setPbToApply(maxPbApplicable);
                      setPbInput("");
                    }}
                  >
                    Max
                  </Button>
                </div>
              )}
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Service price</span>
                  <span>{Formatters.currency(effectivePrice)}</span>
                </div>
                {pbToApply > 0 && (
                  <div className="flex justify-between text-success font-medium">
                    <span>PawBucks applied</span>
                    <span>-{Formatters.currency(pbDiscountUsd)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1.5 border-t border-border/50">
                  <span>Cash due</span>
                  <span className="text-primary">{Formatters.currency(cashDue)}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                PawBucks are debited from your wallet only when {merchantName} confirms the booking.
              </p>
            </div>
          )}

          {/* Rewards earned */}
          <div className="rounded-md bg-foreground text-background px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <PawBucksLogo className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xs font-semibold">
                You&apos;ll earn{" "}
                <span className="text-primary">+{earnPb.toLocaleString()} PawBucks</span> on this booking
              </div>
              <div className="text-[11px] opacity-70">
                Earned on the USD portion only · Credited after service is complete
              </div>
            </div>
          </div>

          {/* Grooming */}
          {isGroomingService && (
            <GroomingPetSelector
              merchantId={merchantId}
              baseDuration={selectedServiceData.duration_minutes}
              basePrice={selectedServiceData.price}
              groomingData={groomingData}
              onGroomingDataChange={setGroomingData}
            />
          )}

          {/* Mobile address */}
          {isMobileService && (
            <div className="space-y-2">
              <Label htmlFor="service-address" className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Your Address (Required)
              </Label>
              <Input
                id="service-address"
                placeholder="Enter the address where you'd like the service..."
                value={serviceAddress}
                onChange={(e) => setServiceAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">The provider will travel to this location</p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="booking-notes" className="text-sm">
              Special Requests (Optional)
            </Label>
            <Textarea
              id="booking-notes"
              placeholder="Any special instructions or requests..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Request notice */}
          <div className="rounded-md bg-warning/10 border border-warning/30 px-3 py-2.5 flex gap-2">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning-foreground/90 leading-relaxed">
              Your booking will be submitted as a <strong>request</strong>. {merchantName} will review and
              confirm it fits their schedule. You won&apos;t be charged until the booking is confirmed.
            </p>
          </div>

          {/* Deposit notice */}
          {(selectedServiceData as any).require_deposit &&
            (merchantAcceptsCards ? (
              <div className="rounded-md bg-info/10 border border-info/30 px-3 py-2.5 flex gap-2 text-xs text-info">
                <CreditCard aria-hidden />
                <p>
                  This service requires a <strong>card on file</strong> to book.
                  {(selectedServiceData as any).no_show_fee_amount > 0 && (
                    <>
                      {" "}A {Formatters.currency(Number((selectedServiceData as any).no_show_fee_amount))}{" "}
                      no-show fee applies if you miss your appointment.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2.5 flex gap-2 text-xs text-destructive">
                <Ban aria-hidden />
                <p>
                  <strong>This service can&apos;t be booked online yet.</strong> {merchantName} hasn&apos;t
                  finished setting up payment processing. Please contact them directly to book.
                </p>
              </div>
            ))}

          {/* Submit */}
          {user ? (
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                if ((selectedServiceData as any).require_deposit && !savedPaymentMethodId) {
                  setStep(5);
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
                  Submitting…
                </>
              ) : (selectedServiceData as any).require_deposit && !savedPaymentMethodId ? (
                <>
                  Continue to Card Setup <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  <PawBucksIcon className="w-4 h-4 mr-2" />
                  Book & Earn PawBucks
                </>
              )}
            </Button>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={() => navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`)}
            >
              Sign in to Book <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}

      {/* ── STEP 5: Deposit ───────────────────────────────────────────────── */}
      {step === 5 && selectedServiceData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">Save Card on File</h3>
            <Button variant="ghost" size="sm" onClick={() => setStep(4)}>
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
              createBooking.mutate();
            }}
            onCancel={() => setStep(4)}
          />
        </div>
      )}
    </div>
  );
};
