import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  X,
  Clock,
  Loader2,
  RefreshCw,
  CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ConsultationBooking = {
  id: string;
  user_id: string;
  merchant_id: string | null;
  booking_date: string;
  time_slot: string;
  status: string;
  notes: string | null;
  created_at: string;
  user_email?: string;
};

// Available time slots for rescheduling
const TIME_SLOTS = [
  { label: "9:00 - 9:15 AM", value: "9:00 AM" },
  { label: "9:30 - 9:45 AM", value: "9:30 AM" },
  { label: "10:00 - 10:15 AM", value: "10:00 AM" },
  { label: "10:30 - 10:45 AM", value: "10:30 AM" },
  { label: "11:00 - 11:15 AM", value: "11:00 AM" },
  { label: "11:30 - 11:45 AM", value: "11:30 AM" },
  { label: "12:00 - 12:15 PM", value: "12:00 PM" },
  { label: "12:30 - 12:45 PM", value: "12:30 PM" },
  { label: "1:00 - 1:15 PM", value: "1:00 PM" },
  { label: "1:30 - 1:45 PM", value: "1:30 PM" },
];

interface ConsultationBookingsTabProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsultationBookingsTab({ open, onOpenChange }: ConsultationBookingsTabProps) {
  const [bookings, setBookings] = useState<ConsultationBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<ConsultationBooking | null>(null);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newTimeSlot, setNewTimeSlot] = useState<string>("");
  const [bookedSlotsForDate, setBookedSlotsForDate] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadBookings();
    }
  }, [open]);

  // Fetch booked slots when rescheduling date changes
  useEffect(() => {
    if (!newDate || !rescheduleBooking) return;

    const fetchBookedSlots = async () => {
      const dateStr = format(newDate, "yyyy-MM-dd");
      const { data } = await supabase
        .from("consultation_bookings")
        .select("time_slot")
        .eq("booking_date", dateStr)
        .in("status", ["pending", "confirmed"])
        .neq("id", rescheduleBooking.id);

      setBookedSlotsForDate(data?.map((b) => b.time_slot) || []);
    };

    fetchBookedSlots();
  }, [newDate, rescheduleBooking]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      // Fetch bookings
      const { data: bookingsData, error } = await supabase
        .from("consultation_bookings")
        .select("*")
        .order("booking_date", { ascending: true })
        .order("time_slot", { ascending: true });

      if (error) throw error;

      // Fetch user emails
      const userIds = [...new Set(bookingsData?.map((b) => b.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      const emailMap = new Map(profilesData?.map((p) => [p.id, p.email]) || []);

      const bookingsWithEmail = (bookingsData || []).map((booking) => ({
        ...booking,
        user_email: emailMap.get(booking.user_id) || "Unknown",
      }));

      setBookings(bookingsWithEmail);
    } catch (error) {
      console.error("Failed to load bookings:", error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: "confirmed" | "cancelled") => {
    setUpdating(bookingId);
    try {
      const booking = bookings.find((b) => b.id === bookingId);
      
      const { error } = await supabase
        .from("consultation_bookings")
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (error) throw error;

      // Send email notification
      if (booking) {
        try {
          const formattedDate = format(new Date(booking.booking_date + "T00:00:00"), "EEEE, MMMM d, yyyy");
          
          const { data: emailResult, error: emailInvokeError } = await supabase.functions.invoke("send-consultation-confirmation", {
            body: {
              type: newStatus,
              recipientEmail: booking.user_email,
              bookingDate: formattedDate,
              bookingDateRaw: booking.booking_date,
              timeSlot: booking.time_slot,
              notes: booking.notes,
            },
          });
          
          if (emailInvokeError || (emailResult && !emailResult.success)) {
            const hint = emailResult?.hint || "Check Resend domain configuration";
            console.error("Email failed:", emailResult?.error || emailInvokeError);
            toast.success(`Booking ${newStatus}!`, {
              description: `Email notification failed: ${hint}`,
            });
          } else {
            toast.success(`Booking ${newStatus} and notification email sent!`);
          }
        } catch (emailError) {
          console.error("Failed to send notification email:", emailError);
          toast.success(`Booking ${newStatus}! (Email notification failed)`);
        }
      } else {
        toast.success(`Booking ${newStatus}!`);
      }
      
      loadBookings();
    } catch (error) {
      console.error("Failed to update booking:", error);
      toast.error("Failed to update booking");
    } finally {
      setUpdating(null);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleBooking || !newDate || !newTimeSlot) {
      toast.error("Please select a new date and time");
      return;
    }

    const previousDate = format(new Date(rescheduleBooking.booking_date + "T00:00:00"), "EEEE, MMMM d, yyyy");
    const previousTimeSlot = rescheduleBooking.time_slot;

    setUpdating(rescheduleBooking.id);
    try {
      const dateStr = format(newDate, "yyyy-MM-dd");

      const { error } = await supabase
        .from("consultation_bookings")
        .update({
          booking_date: dateStr,
          time_slot: newTimeSlot,
        })
        .eq("id", rescheduleBooking.id);

      if (error) {
        if (error.code === "23505") {
          toast.error("This time slot is already booked. Please select another.");
          return;
        }
        throw error;
      }

      // Send reschedule email
      try {
        const newFormattedDate = format(newDate, "EEEE, MMMM d, yyyy");
        
        await supabase.functions.invoke("send-consultation-confirmation", {
          body: {
            type: "rescheduled",
            recipientEmail: rescheduleBooking.user_email,
            bookingDate: newFormattedDate,
            bookingDateRaw: dateStr,
            timeSlot: newTimeSlot,
            notes: rescheduleBooking.notes,
            previousDate,
            previousTimeSlot,
          },
        });
        toast.success("Booking rescheduled and notification email sent!");
      } catch (emailError) {
        console.error("Failed to send reschedule email:", emailError);
        toast.success("Booking rescheduled! (Email notification failed)");
      }

      setRescheduleBooking(null);
      setNewDate(undefined);
      setNewTimeSlot("");
      loadBookings();
    } catch (error) {
      console.error("Failed to reschedule booking:", error);
      toast.error("Failed to reschedule booking");
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500">Confirmed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  // Only allow Mon/Wed/Fri for rescheduling
  const disabledDays = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) return true;
    
    const day = date.getDay();
    return day !== 1 && day !== 3 && day !== 5;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Consultation Bookings
            </DialogTitle>
            <DialogDescription>
              Manage consultation appointments - confirm, cancel, or reschedule bookings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={loadBookings} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No consultation bookings found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time (PT)</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">
                        {format(new Date(booking.booking_date + "T00:00:00"), "EEE, MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {booking.time_slot}
                        </div>
                      </TableCell>
                      <TableCell>{booking.user_email}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {booking.notes || "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {booking.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => handleUpdateStatus(booking.id, "confirmed")}
                                disabled={updating === booking.id}
                              >
                                {updating === booking.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4 text-green-500" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => handleUpdateStatus(booking.id, "cancelled")}
                                disabled={updating === booking.id}
                              >
                                <X className="w-4 h-4 text-red-500" />
                              </Button>
                            </>
                          )}
                          {(booking.status === "pending" || booking.status === "confirmed") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              onClick={() => {
                                setRescheduleBooking(booking);
                                setNewDate(new Date(booking.booking_date + "T00:00:00"));
                                setNewTimeSlot(booking.time_slot);
                              }}
                              disabled={updating === booking.id}
                            >
                              <CalendarIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleBooking} onOpenChange={(open) => !open && setRescheduleBooking(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reschedule Consultation</DialogTitle>
            <DialogDescription>
              Select a new date and time for this consultation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">New Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "EEE, MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={setNewDate}
                    disabled={disabledDays}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1">
                Only Mon/Wed/Fri available
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">New Time (PT)</label>
              <Select value={newTimeSlot} onValueChange={setNewTimeSlot}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = bookedSlotsForDate.includes(slot.value);
                    return (
                      <SelectItem
                        key={slot.value}
                        value={slot.value}
                        disabled={isBooked}
                      >
                        {slot.label} {isBooked && "(Booked)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRescheduleBooking(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleReschedule}
                disabled={!newDate || !newTimeSlot || updating === rescheduleBooking?.id}
              >
                {updating === rescheduleBooking?.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Reschedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}