import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays, addHours, startOfDay } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { schedulingService } from "@/services/api/scheduling.service";
import { toast } from "sonner";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  merchant_id: string;
  service_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  user_id?: string | null;
  merchant_services?: {
    name?: string;
    duration_minutes?: number;
    buffer_minutes?: number;
    min_notice_hours?: number;
  } | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  /** Who is initiating the reschedule. Used for the notification copy. */
  initiator: "customer" | "merchant";
  onRescheduled?: () => void;
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${nh.toString().padStart(2, "0")}:${nm.toString().padStart(2, "0")}:00`;
}

export function RescheduleBookingDialog({ open, onOpenChange, booking, initiator, onRescheduled }: Props) {
  const qc = useQueryClient();
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(undefined);
      setSlot(null);
    }
  }, [open, booking?.id]);

  const merchantId = booking?.merchant_id;
  const serviceId = booking?.service_id;
  const duration = booking?.merchant_services?.duration_minutes ?? 30;
  const minNoticeHours = booking?.merchant_services?.min_notice_hours ?? 0;

  const { data: availability = [] } = useQuery({
    queryKey: ["reschedule-availability", merchantId],
    queryFn: () => schedulingService.getAvailability(merchantId!),
    enabled: open && !!merchantId,
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["reschedule-overrides", merchantId],
    queryFn: () =>
      schedulingService.getOverrides(
        merchantId!,
        format(new Date(), "yyyy-MM-dd"),
        format(addDays(new Date(), 60), "yyyy-MM-dd"),
      ),
    enabled: open && !!merchantId,
  });

  const { data: dayBookings = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["reschedule-day-bookings", merchantId, date && format(date, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!merchantId || !date) return [];
      const all = await schedulingService.getBookingsForDate(merchantId, format(date, "yyyy-MM-dd"));
      // exclude the booking being rescheduled so its current slot is selectable
      return all.filter((b) => b.id !== booking?.id);
    },
    enabled: open && !!merchantId && !!date,
  });

  const slots = useMemo(() => {
    if (!date) return [] as string[];
    return schedulingService.generateTimeSlots(availability, overrides, dayBookings as any, date, duration);
  }, [availability, overrides, dayBookings, date, duration]);

  const reschedule = useMutation({
    mutationFn: async () => {
      if (!booking || !date || !slot) throw new Error("Pick a date and time");
      const newDate = format(date, "yyyy-MM-dd");
      const newStart = `${slot}:00`;
      const newEnd = addMinutesToTime(slot, duration);

      const { error } = await supabase
        .from("service_bookings")
        .update({
          booking_date: newDate,
          start_time: newStart,
          end_time: newEnd,
          rescheduled_from_id: booking.id,
          // Keep status; reset reminders so they re-fire for new time
          reminder_24h_sent: false,
          reminder_1h_sent: false,
        })
        .eq("id", booking.id);
      if (error) throw error;

      // Best-effort notification email
      try {
        await supabase.functions.invoke("send-booking-emails", {
          body: {
            type: "reschedule",
            bookingId: booking.id,
            initiator,
          },
        });
      } catch (err) {
        console.error("reschedule email failed", err);
      }
    },
    onSuccess: () => {
      toast.success("Appointment rescheduled");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["merchant-bookings"] });
      onRescheduled?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to reschedule"),
  });

  const minDate = addHours(new Date(), minNoticeHours);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            Reschedule appointment
          </DialogTitle>
          {booking && (
            <DialogDescription>
              Currently {format(new Date(`${booking.booking_date}T${booking.start_time}`), "EEE, MMM d")} at{" "}
              {formatTime(booking.start_time)}. Pick a new date and time below.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                setSlot(null);
              }}
              disabled={(d) => d < startOfDay(minDate) || d > addDays(new Date(), 60)}
              className="rounded-md border pointer-events-auto"
            />
          </div>

          {date && (
            <div>
              <p className="text-sm font-medium mb-2">
                Available times for {format(date, "MMM d")}
              </p>
              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-9 rounded-md" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No available times on this date.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                  {slots.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={slot === s ? "default" : "outline"}
                      onClick={() => setSlot(s)}
                      className={cn("text-xs", slot === s && "ring-2 ring-primary ring-offset-2")}
                    >
                      {formatTime(s)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => reschedule.mutate()}
            disabled={!date || !slot || reschedule.isPending}
          >
            {reschedule.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rescheduling...</>
            ) : (
              "Confirm new time"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
