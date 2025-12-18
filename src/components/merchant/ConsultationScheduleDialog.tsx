import { useState, useMemo } from "react";
import { format, addDays, isSameDay, isWeekend, startOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConsultationScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantName?: string;
}

// Available time slots for consultations (15-minute slots)
const TIME_SLOTS = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
];

export function ConsultationScheduleDialog({
  open,
  onOpenChange,
  merchantName,
}: ConsultationScheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Calculate available dates (next 14 business days, excluding weekends)
  const disabledDays = useMemo(() => {
    return [
      { before: startOfDay(addDays(new Date(), 1)) }, // Can't book today or past
      { dayOfWeek: [0, 6] }, // Disable weekends
    ];
  }, []);

  // Simulate some booked slots for realism
  const bookedSlots = useMemo(() => {
    if (!selectedDate) return [];
    // Generate some random "booked" slots based on the date
    const seed = selectedDate.getDate();
    const booked: string[] = [];
    if (seed % 3 === 0) booked.push("10:00 AM");
    if (seed % 4 === 0) booked.push("2:00 PM");
    if (seed % 5 === 0) booked.push("11:00 AM", "3:30 PM");
    return booked;
  }, [selectedDate]);

  const availableSlots = useMemo(() => {
    return TIME_SLOTS.filter((slot) => !bookedSlots.includes(slot));
  }, [bookedSlots]);

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select both a date and time");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsConfirmed(true);
    
    toast.success("Consultation scheduled successfully!", {
      description: `${format(selectedDate, "EEEE, MMMM d")} at ${selectedTime}`,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setSelectedDate(undefined);
      setSelectedTime(null);
      setIsConfirmed(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Schedule Free Consultation
          </DialogTitle>
          <DialogDescription>
            Book a free 15-minute consultation with our merchant success team to discuss your business goals.
          </DialogDescription>
        </DialogHeader>

        {isConfirmed ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">You're all set!</h3>
            <p className="text-muted-foreground mb-4">
              Your consultation is scheduled for:
            </p>
            <div className="inline-flex flex-col items-center gap-1 p-4 rounded-lg bg-muted">
              <p className="font-semibold text-lg">
                {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-primary font-medium">{selectedTime}</p>
              <Badge variant="outline" className="mt-2">
                <Clock className="w-3 h-3 mr-1" />
                15 minutes
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              You'll receive a confirmation email with calendar invite and video call link.
            </p>
            <Button className="mt-6" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Calendar */}
            <div>
              <h4 className="text-sm font-medium mb-3">Select a Date</h4>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(null); // Reset time when date changes
                  }}
                  disabled={disabledDays}
                  fromDate={addDays(new Date(), 1)}
                  toDate={addDays(new Date(), 30)}
                  className="rounded-md border pointer-events-auto"
                />
              </div>
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div>
                <h4 className="text-sm font-medium mb-3">
                  Available Times for {format(selectedDate, "MMMM d")}
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = bookedSlots.includes(slot);
                    const isSelected = selectedTime === slot;
                    
                    return (
                      <Button
                        key={slot}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        disabled={isBooked}
                        onClick={() => setSelectedTime(slot)}
                        className={cn(
                          "text-xs",
                          isBooked && "opacity-50 line-through",
                          isSelected && "ring-2 ring-primary ring-offset-2"
                        )}
                      >
                        {slot}
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

            {/* Summary */}
            {selectedDate && selectedTime && (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <h4 className="text-sm font-medium mb-2">Your Selection</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {format(selectedDate, "EEEE, MMMM d")}
                    </p>
                    <p className="text-sm text-muted-foreground">at {selectedTime}</p>
                  </div>
                  <Badge>
                    <Clock className="w-3 h-3 mr-1" />
                    15 min
                  </Badge>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={!selectedDate || !selectedTime || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
