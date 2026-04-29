import { useState, useEffect } from"react";
import { format, addDays, startOfDay, getDay } from"date-fns";
import { Calendar } from"@/components/ui/calendar";
import { Button } from"@/components/ui/button";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Badge } from"@/components/ui/badge";
import { toast } from"sonner";
import { Clock, CalendarDays, CheckCircle2, Loader2 } from"lucide-react";
import { cn } from"@/lib/utils";
import { supabase } from"@/integrations/supabase/client";
import { useAuth } from"@/hooks/useAuth";

interface ConsultationScheduleDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 merchantName?: string;
}

// Available time slots for 15-minute consultations (Pacific Time)
const TIME_SLOTS = [
 { label:"9:00 - 9:15 AM", value:"9:00 AM" },
 { label:"9:30 - 9:45 AM", value:"9:30 AM" },
 { label:"10:00 - 10:15 AM", value:"10:00 AM" },
 { label:"10:30 - 10:45 AM", value:"10:30 AM" },
 { label:"11:00 - 11:15 AM", value:"11:00 AM" },
 { label:"11:30 - 11:45 AM", value:"11:30 AM" },
 { label:"12:00 - 12:15 PM", value:"12:00 PM" },
 { label:"12:30 - 12:45 PM", value:"12:30 PM" },
 { label:"1:00 - 1:15 PM", value:"1:00 PM" },
 { label:"1:30 - 1:45 PM", value:"1:30 PM" },
];

export function ConsultationScheduleDialog({
 open,
 onOpenChange,
 merchantName,
}: ConsultationScheduleDialogProps) {
 const { user } = useAuth();
 const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
 const [selectedTime, setSelectedTime] = useState<string | null>(null);
 const [selectedTimeLabel, setSelectedTimeLabel] = useState<string | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [isConfirmed, setIsConfirmed] = useState(false);
 const [bookedSlots, setBookedSlots] = useState<string[]>([]);
 const [isLoadingSlots, setIsLoadingSlots] = useState(false);

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

 // Fetch booked slots when date changes
 useEffect(() => {
 if (!selectedDate) {
 setBookedSlots([]);
 return;
 }

 const fetchBookedSlots = async () => {
 setIsLoadingSlots(true);
 try {
 const dateStr = format(selectedDate,"yyyy-MM-dd");
 // Use secure view that only exposes aggregated slot data (no user info)
 const { data, error } = await supabase
 .from("consultation_slot_availability")
 .select("time_slot")
 .eq("booking_date", dateStr);

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
 }, [selectedDate]);

 const handleSchedule = async () => {
 if (!selectedDate || !selectedTime || !user) {
 toast.error("Please select both a date and time");
 return;
 }

 setIsSubmitting(true);
 
 try {
 const dateStr = format(selectedDate,"yyyy-MM-dd");

 // Insert booking into database
 const { error: bookingError } = await supabase
 .from("consultation_bookings")
 .insert({
 user_id: user.id,
 booking_date: dateStr,
 time_slot: selectedTime,
 status:"pending",
 notes: merchantName ? `Business: ${merchantName}` : null,
 });

 if (bookingError) {
 if (bookingError.code ==="23505") {
 toast.error("This time slot was just booked. Please select another.");
 // Refresh booked slots
 const { data } = await supabase
 .from("consultation_bookings")
 .select("time_slot")
 .eq("booking_date", dateStr)
 .in("status", ["pending","confirmed"]);
 setBookedSlots(data?.map((b) => b.time_slot) || []);
 setSelectedTime(null);
 setSelectedTimeLabel(null);
 return;
 }
 throw bookingError;
 }

 // Create in-app notification for admin
 try {
 await supabase.from("notifications").insert({
 user_id: null, // Admin notification (null = broadcast to admins)
 title:"New Consultation Request",
 message: `${user?.email ||"A user"} requested a consultation for ${format(selectedDate,"EEEE, MMMM d")} at ${selectedTimeLabel} PT.${merchantName ? ` Business: ${merchantName}` :""}`,
 category:"consultation",
 is_read: false,
 });
 } catch (notifError) {
 console.error("Failed to create admin notification:", notifError);
 }

 // Send email notification to admin (admin@pawbucks.app)
 try {
 await supabase.functions.invoke("send-consultation-confirmation", {
 body: {
 type:"request",
 recipientEmail:"admin@pawbucks.app",
 bookingDate: format(selectedDate,"EEEE, MMMM d, yyyy"),
 bookingDateRaw: dateStr,
 timeSlot: selectedTime,
 requesterEmail: user?.email,
 merchantName: merchantName,
 },
 });
 } catch (emailError) {
 console.error("Failed to send admin email notification:", emailError);
 }

 setIsConfirmed(true);
 toast.success("Consultation booked!", {
 description: `${format(selectedDate,"EEEE, MMMM d")} at ${selectedTimeLabel} PT`,
 });
 } catch (error) {
 console.error("Failed to schedule consultation:", error);
 toast.error("Failed to book. Please try again.");
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleClose = () => {
 onOpenChange(false);
 // Reset state after dialog closes
 setTimeout(() => {
 setSelectedDate(undefined);
 setSelectedTime(null);
 setSelectedTimeLabel(null);
 setIsConfirmed(false);
 setBookedSlots([]);
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
 {selectedDate && format(selectedDate,"EEEE, MMMM d, yyyy")}
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
 Available Times for {format(selectedDate,"MMMM d")} (Pacific Time)
 </h4>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {TIME_SLOTS.map((slot) => {
 const isBooked = bookedSlots.includes(slot.value);
 const isSelected = selectedTime === slot.value;
 
 return (
 <Button
 key={slot.value}
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

 {/* Summary */}
 {selectedDate && selectedTime && (
 <div className="p-4 rounded-lg bg-muted/50 border">
 <h4 className="text-sm font-medium mb-2">Your Selection</h4>
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium">
 {format(selectedDate,"EEEE, MMMM d")}
 </p>
 <p className="text-sm text-muted-foreground">at {selectedTimeLabel} PT</p>
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
