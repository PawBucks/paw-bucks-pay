import { useState, useEffect, useCallback } from"react";
import { format } from"date-fns";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Calendar } from"@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from"@/components/ui/popover";
import { toast } from"sonner";
import { AlertCircle, Calendar as CalendarIcon, Check, CheckCircle2, Clock, Loader2, RefreshCw, Users, X, XCircle } from "lucide-react";
import { cn } from"@/lib/utils";

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

export function ConsultationBookingsTab() {
 const [bookings, setBookings] = useState<ConsultationBooking[]>([]);
 const [loading, setLoading] = useState(true);
 const [updating, setUpdating] = useState<string | null>(null);
 const [rescheduleBooking, setRescheduleBooking] = useState<ConsultationBooking | null>(null);
 const [newDate, setNewDate] = useState<Date | undefined>(undefined);
 const [newTimeSlot, setNewTimeSlot] = useState<string>("");
 const [bookedSlotsForDate, setBookedSlotsForDate] = useState<string[]>([]);
 const [statusFilter, setStatusFilter] = useState<string>("all");

 useEffect(() => {
 loadBookings();
 }, []);

 // Fetch booked slots when rescheduling date changes
 useEffect(() => {
 if (!newDate || !rescheduleBooking) return;

 const fetchBookedSlots = async () => {
 const dateStr = format(newDate,"yyyy-MM-dd");
 const { data } = await supabase
 .from("consultation_bookings")
 .select("time_slot")
 .eq("booking_date", dateStr)
 .in("status", ["pending","confirmed"])
 .neq("id", rescheduleBooking.id);

 setBookedSlotsForDate(data?.map((b) => b.time_slot) || []);
 };

 fetchBookedSlots();
 }, [newDate, rescheduleBooking]);

 const loadBookings = useCallback(async () => {
 setLoading(true);
 try {
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
 user_email: emailMap.get(booking.user_id) ||"Unknown",
 }));

 setBookings(bookingsWithEmail);
 } catch (error) {
 console.error("Failed to load bookings:", error);
 toast.error("Failed to load bookings");
 } finally {
 setLoading(false);
 }
 }, []);

 const handleUpdateStatus = useCallback(async (bookingId: string, newStatus:"confirmed" |"cancelled") => {
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
 const formattedDate = format(new Date(booking.booking_date +"T00:00:00"),"EEEE, MMMM d, yyyy");
 
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
 const hint = emailResult?.hint ||"Check Resend domain configuration";
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
 }, [bookings, loadBookings]);

 const handleReschedule = async () => {
 if (!rescheduleBooking || !newDate || !newTimeSlot) {
 toast.error("Please select a new date and time");
 return;
 }

 const previousDate = format(new Date(rescheduleBooking.booking_date +"T00:00:00"),"EEEE, MMMM d, yyyy");
 const previousTimeSlot = rescheduleBooking.time_slot;

 setUpdating(rescheduleBooking.id);
 try {
 const dateStr = format(newDate,"yyyy-MM-dd");

 const { error } = await supabase
 .from("consultation_bookings")
 .update({
 booking_date: dateStr,
 time_slot: newTimeSlot,
 })
 .eq("id", rescheduleBooking.id);

 if (error) {
 if (error.code ==="23505") {
 toast.error("This time slot is already booked. Please select another.");
 return;
 }
 throw error;
 }

 // Send reschedule email
 try {
 const newFormattedDate = format(newDate,"EEEE, MMMM d, yyyy");
 
 await supabase.functions.invoke("send-consultation-confirmation", {
 body: {
 type:"rescheduled",
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
 case"confirmed":
 return <Badge className="bg-success">Confirmed</Badge>;
 case"cancelled":
 return <Badge variant="destructive">Cancelled</Badge>;
 case"completed":
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

 // Filter bookings by status
 const filteredBookings = statusFilter ==="all" 
 ? bookings 
 : bookings.filter(b => b.status === statusFilter);

 // Stats
 const stats = {
 total: bookings.length,
 pending: bookings.filter(b => b.status ==="pending").length,
 confirmed: bookings.filter(b => b.status ==="confirmed").length,
 cancelled: bookings.filter(b => b.status ==="cancelled").length,
 };

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-3xl font-bold">Consultation Bookings</h2>
 <p className="text-muted-foreground">
 Manage consultation appointments - confirm, cancel, or reschedule bookings
 </p>
 </div>

 {/* Stats Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-2">
 <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
 <span className="text-sm text-muted-foreground">Total</span>
 </div>
 <p className="text-2xl font-bold">{stats.total}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-warning" />
 <span className="text-sm text-muted-foreground">Pending</span>
 </div>
 <p className="text-2xl font-bold text-warning">{stats.pending}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-success" />
 <span className="text-sm text-muted-foreground">Confirmed</span>
 </div>
 <p className="text-2xl font-bold text-success">{stats.confirmed}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center gap-2">
 <XCircle className="w-4 h-4 text-destructive" />
 <span className="text-sm text-muted-foreground">Cancelled</span>
 </div>
 <p className="text-2xl font-bold text-destructive">{stats.cancelled}</p>
 </CardContent>
 </Card>
 </div>

 {/* Filters and Actions */}
 <div className="flex flex-col sm:flex-row justify-between gap-4">
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-full sm:w-[180px]">
 <SelectValue placeholder="Filter by status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Statuses</SelectItem>
 <SelectItem value="pending">Pending</SelectItem>
 <SelectItem value="confirmed">Confirmed</SelectItem>
 <SelectItem value="cancelled">Cancelled</SelectItem>
 <SelectItem value="completed">Completed</SelectItem>
 </SelectContent>
 </Select>
 
 <Button variant="outline" onClick={loadBookings} disabled={loading}>
 <RefreshCw className={cn("w-4 h-4 mr-2", loading &&"animate-spin")} />
 Refresh
 </Button>
 </div>

 {/* Bookings Table */}
 {loading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 ) : filteredBookings.length === 0 ? (
 <Card>
 <CardContent className="flex flex-col items-center justify-center py-12">
 <CalendarIcon className="w-12 h-12 text-muted-foreground mb-4" aria-hidden="true" />
 <p className="text-muted-foreground">No consultation bookings found</p>
 </CardContent>
 </Card>
 ) : (
 <div className="border rounded-lg overflow-x-auto">
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
 {filteredBookings.map((booking) => (
 <TableRow key={booking.id}>
 <TableCell className="font-medium">
 {format(new Date(booking.booking_date +"T00:00:00"),"EEE, MMM d, yyyy")}
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-1">
 <Clock className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
 {booking.time_slot}
 </div>
 </TableCell>
 <TableCell>{booking.user_email}</TableCell>
 <TableCell className="max-w-xs truncate">
 {booking.notes ||"-"}
 </TableCell>
 <TableCell>{getStatusBadge(booking.status)}</TableCell>
 <TableCell>
 <div className="flex gap-1">
 {booking.status ==="pending" && (
 <>
 <Button
 size="sm"
 variant="outline"
 className="h-8 w-8 p-0"
 onClick={() => handleUpdateStatus(booking.id,"confirmed")}
 disabled={updating === booking.id}
 title="Confirm booking"
 >
 {updating === booking.id ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Check className="w-4 h-4 text-success" />
 )}
 </Button>
 <Button
 size="sm"
 variant="outline"
 className="h-8 w-8 p-0"
 onClick={() => handleUpdateStatus(booking.id,"cancelled")}
 disabled={updating === booking.id}
 title="Cancel booking"
 >
 <X className="w-4 h-4 text-destructive" />
 </Button>
 </>
 )}
 {(booking.status ==="pending" || booking.status ==="confirmed") && (
 <Button
 size="sm"
 variant="outline"
 className="h-8 px-2"
 onClick={() => {
 setRescheduleBooking(booking);
 setNewDate(new Date(booking.booking_date +"T00:00:00"));
 setNewTimeSlot(booking.time_slot);
 }}
 disabled={updating === booking.id}
 title="Reschedule booking"
 >
 <CalendarIcon className="w-4 h-4" aria-hidden="true" />
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

 {/* What are Consultations Card */}
 <Card>
 <CardHeader>
 <CardTitle className="text-base">About Consultations</CardTitle>
 </CardHeader>
 <CardContent className="text-sm text-muted-foreground space-y-2">
 <p>
 Consultations are 15-minute video calls scheduled by users to discuss their 
 questions or get personalized guidance.
 </p>
 <ul className="list-disc list-inside space-y-1 ml-2">
 <li><strong>Confirm:</strong> Approves the booking and sends a confirmation email</li>
 <li><strong>Cancel:</strong> Rejects the booking and notifies the user</li>
 <li><strong>Reschedule:</strong> Changes the date/time and notifies the user</li>
 </ul>
 </CardContent>
 </Card>

 {/* Reschedule Dialog */}
 <Dialog open={!!rescheduleBooking} onOpenChange={(open) => !open && setRescheduleBooking(null)}>
 <DialogContent className="sm:max-w-[400px]">
 <DialogHeader>
 <DialogTitle>Reschedule Consultation</DialogTitle>
 <DialogDescription>
 Select a new date and time for this consultation. An email will be sent to notify the user.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4">
 <div>
 <label className="text-sm font-medium mb-2 block">New Date</label>
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" className="w-full justify-start text-left">
 <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
 {newDate ? format(newDate,"EEE, MMM d, yyyy") :"Select date"}
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
 {slot.label} {isBooked &&"(Booked)"}
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
 </div>
 );
}
