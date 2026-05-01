import { useState } from"react";
import { useAuth } from"@/hooks/useAuth";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { format, isPast, isToday, addHours, parseISO } from"date-fns";
import { parseLocalDate } from"@/utils/formatters";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from"@/components/ui/alert-dialog";
import { Textarea } from"@/components/ui/textarea";
import { Calendar } from"@/components/ui/calendar";
import { Skeleton } from"@/components/ui/skeleton";
import { toast } from"sonner";
import {
 Calendar as CalendarIcon,
 Clock,
 MapPin,
 ArrowLeft,
 XCircle,
 RefreshCw,
 CheckCircle2,
 AlertTriangle,
 Download,
 Store,
 PawPrint,
} from"lucide-react";
import { useNavigate } from"react-router-dom";
import { cn } from"@/lib/utils";
import { GroomingReportCardView } from"@/components/scheduling/GroomingReportCardView";

import { Formatters } from "@/utils/formatters";
type BookingStatus ="pending" |"confirmed" |"cancelled" |"completed" |"no_show";

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; icon: any }> = {
 pending: { label:"Pending", color:"bg-warning/10 text-warning border-warning/20", icon: Clock },
 confirmed: { label:"Confirmed", color:"bg-chart-1/10 text-chart-1 border-chart-1/20", icon: CheckCircle2 },
 cancelled: { label:"Cancelled", color:"bg-muted text-muted-foreground border-border", icon: XCircle },
 completed: { label:"Completed", color:"bg-success/10 text-success border-success/20", icon: CheckCircle2 },
 no_show: { label:"No Show", color:"bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
};

function formatTime(time: string) {
 const [hours, minutes] = time.split(":").map(Number);
 const period = hours >= 12 ?"PM" :"AM";
 return `${hours % 12 || 12}:${minutes.toString().padStart(2,"0")} ${period}`;
}

function generateICS(booking: any): string {
 const date = booking.booking_date.replace(/-/g,"");
 const startTime = booking.start_time.replace(/:/g,"").slice(0, 4) +"00";
 const endTime = booking.end_time.replace(/:/g,"").slice(0, 4) +"00";
 const serviceName = booking.merchant_services?.name ||"Appointment";
 const merchantName = booking.merchant_services?.merchants?.business_name ||"";

 return [
"BEGIN:VCALENDAR",
"VERSION:2.0",
"PRODID:-//PawBucks//Booking//EN",
"BEGIN:VEVENT",
 `DTSTART:${date}T${startTime}`,
 `DTEND:${date}T${endTime}`,
 `SUMMARY:${serviceName} at ${merchantName}`,
 `DESCRIPTION:Booked via PawBucks`,
 `LOCATION:${booking.merchant_services?.merchants?.address ||""}`,
"STATUS:CONFIRMED",
"END:VEVENT",
"END:VCALENDAR",
 ].join("\r\n");
}

function downloadICS(booking: any) {
 const ics = generateICS(booking);
 const blob = new Blob([ics], { type:"text/calendar;charset=utf-8" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `booking-${booking.id.slice(0, 8)}.ics`;
 a.click();
 URL.revokeObjectURL(url);
}

export default function MyBookings() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const sharedAccount = useSharedAccount(user?.id);
 const effectiveUserId = getEffectiveWalletUserId(user?.id, sharedAccount);
 const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
 const [cancelReason, setCancelReason] = useState("");
 const [selectedBooking, setSelectedBooking] = useState<any>(null);
 const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
 const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
 const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);

 const queryUserId = effectiveUserId || user?.id;

 const { data: bookings = [], isLoading } = useQuery({
 queryKey: ["my-bookings", queryUserId],
 queryFn: async () => {
 if (!queryUserId) return [];
 const { data, error } = await supabase
 .from("service_bookings")
 .select(`
 *,
 merchant_services (
 name, duration_minutes, category, price, buffer_minutes, cancellation_policy_hours,
 merchants!inner (id, business_name, address, logo_url, storefront_slug)
 ),
 pet_profiles (id, name, type)
 `)
 .eq("user_id", queryUserId)
 .order("booking_date", { ascending: false })
 .order("start_time", { ascending: false });
 if (error) throw error;
 return data || [];
 },
 enabled: !!queryUserId && !sharedAccount.isLoading,
 });

 const cancelBooking = useMutation({
 mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
 const { error } = await supabase
 .from("service_bookings")
 .update({ status:"cancelled", cancellation_reason: reason })
 .eq("id", id)
 .eq("user_id", user?.id);
 if (error) throw error;
 },
 onSuccess: (_, variables) => {
 toast.success("Booking cancelled successfully");
 queryClient.invalidateQueries({ queryKey: ["my-bookings"] });

 // Send cancellation email (fire-and-forget)
 if (selectedBooking) {
 supabase.functions.invoke("send-booking-emails", {
 body: {
 type:"cancellation",
 bookingId: selectedBooking.id,
 cancellationReason: variables.reason,
 },
 }).catch((err) => console.error("Failed to send cancellation email:", err));
 }

 setCancelDialogOpen(false);
 setCancelReason("");
 setSelectedBooking(null);
 },
 onError: () => toast.error("Failed to cancel booking"),
 });

 const canCancel = (booking: any) => {
 if (booking.status !=="pending" && booking.status !=="confirmed") return false;
 const policyHours = booking.merchant_services?.cancellation_policy_hours || 24;
 const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
 return bookingDateTime > addHours(new Date(), policyHours);
 };

 const canReschedule = (booking: any) => {
 return canCancel(booking); // Same rules for now
 };

 const upcomingBookings = bookings.filter(
 (b: any) => !isPast(parseLocalDate(b.booking_date)) || isToday(parseLocalDate(b.booking_date))
 ).filter((b: any) => b.status !=="cancelled");

 const pastBookings = bookings.filter(
 (b: any) => isPast(parseLocalDate(b.booking_date)) && !isToday(parseLocalDate(b.booking_date))
 );

 const cancelledBookings = bookings.filter((b: any) => b.status ==="cancelled");

 const BookingCard = ({ booking }: { booking: any }) => {
 const status = booking.status as BookingStatus;
 const config = STATUS_CONFIG[status];
 const StatusIcon = config.icon;
 const merchant = booking.merchant_services?.merchants;
 const isUpcoming = !isPast(parseLocalDate(booking.booking_date)) || isToday(parseLocalDate(booking.booking_date));

 return (
 <Card className="overflow-hidden transition-all hover:shadow-md">
 <CardContent className="p-4">
 <div className="flex items-start justify-between gap-3 mb-3">
 <div className="flex items-center gap-3 min-w-0">
 {merchant?.logo_url ? (
 <img src={merchant.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
 ) : (
 <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Store className="w-5 h-5 text-primary" />
 </div>
 )}
 <div className="min-w-0">
 <p className="font-semibold truncate">{booking.merchant_services?.name}</p>
 <p className="text-sm text-muted-foreground truncate">{merchant?.business_name}</p>
 </div>
 </div>
 <Badge variant="outline" className={cn("text-xs flex-shrink-0 gap-1", config.color)}>
 <StatusIcon className="w-3 h-3" />
 {config.label}
 </Badge>
 </div>

 <div className="grid grid-cols-2 gap-2 text-sm mb-3">
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <CalendarIcon className="w-3.5 h-3.5" />
 {format(parseLocalDate(booking.booking_date),"EEE, MMM d")}
 </div>
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <Clock className="w-3.5 h-3.5" />
 {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
 </div>
 {booking.pet_profiles && (
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <PawPrint className="w-3.5 h-3.5" />
 {booking.pet_profiles.name}
 </div>
 )}
 {merchant?.address && (
 <div className="flex items-center gap-1.5 text-muted-foreground">
 <MapPin className="w-3.5 h-3.5" />
 <span className="truncate">{merchant.address}</span>
 </div>
 )}
 </div>

 {/* Pending approval notice */}
 {status ==="pending" && isUpcoming && (
 <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning mb-3">
 <Clock className="w-3.5 h-3.5 flex-shrink-0" />
 <span>Awaiting confirmation from {merchant?.business_name ||'the business'}</span>
 </div>
 )}

 <div className="flex items-center justify-between pt-3 border-t">
 <span className="font-semibold text-primary">{Formatters.currency(booking.total_price)}</span>
 {isUpcoming && status !=="cancelled" && (
 <div className="flex gap-2">
 <Button
 size="sm"
 variant="ghost"
 className="h-8 text-xs"
 onClick={() => downloadICS(booking)}
 >
 <Download className="w-3 h-3 mr-1" />
 Calendar
 </Button>
 {canCancel(booking) && (
 <Button
 size="sm"
 variant="outline"
 className="h-8 text-xs text-destructive hover:bg-destructive/10"
 onClick={() => {
 setSelectedBooking(booking);
 setCancelDialogOpen(true);
 }}
 >
 <XCircle className="w-3 h-3 mr-1" />
 Cancel
 </Button>
 )}
 </div>
 )}
 {status ==="completed" && merchant?.storefront_slug && (
 <Button
 size="sm"
 variant="outline"
 className="h-8 text-xs"
 onClick={() => navigate(`/book/${merchant.storefront_slug}`)}
 >
 <RefreshCw className="w-3 h-3 mr-1" />
 Rebook
 </Button>
 )}
 </div>

 {/* Grooming Report Card for completed bookings */}
 {status ==="completed" && (
 <div className="mt-3">
 <GroomingReportCardView bookingId={booking.id} />
 </div>
 )}
 </CardContent>
 </Card>
 );
 };

 const EmptyState = ({ message }: { message: string }) => (
 <div className="text-center py-12 text-muted-foreground">
 <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
 <p className="font-medium">{message}</p>
 <Button variant="link" className="mt-2" onClick={() => navigate("/discover")}>
 Browse services to book
 </Button>
 </div>
 );

 return (
 <div className="min-h-screen bg-background">
 <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 py-6 pb-24">
 {/* Header */}
 <div className="flex items-center gap-3 mb-6">
 <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
 <ArrowLeft className="w-5 h-5" />
 </Button>
 <div>
 <h1 className="text-2xl font-bold">My Bookings</h1>
 <p className="text-sm text-muted-foreground">Manage your appointments</p>
 </div>
 </div>

 <Tabs defaultValue="upcoming" className="space-y-4">
 <TabsList className="w-full grid grid-cols-3">
 <TabsTrigger value="upcoming" className="text-xs">
 Upcoming ({upcomingBookings.length})
 </TabsTrigger>
 <TabsTrigger value="past" className="text-xs">
 Past ({pastBookings.length})
 </TabsTrigger>
 <TabsTrigger value="cancelled" className="text-xs">
 Cancelled ({cancelledBookings.length})
 </TabsTrigger>
 </TabsList>

 {isLoading ? (
 <div className="space-y-3">
 {[1, 2, 3].map((i) => (
 <Skeleton key={i} className="h-40 w-full rounded-lg" />
 ))}
 </div>
 ) : (
 <>
 <TabsContent value="upcoming" className="space-y-3">
 {upcomingBookings.length === 0 ? (
 <EmptyState message="No upcoming bookings" />
 ) : (
 upcomingBookings.map((b: any) => <BookingCard key={b.id} booking={b} />)
 )}
 </TabsContent>

 <TabsContent value="past" className="space-y-3">
 {pastBookings.length === 0 ? (
 <EmptyState message="No past bookings" />
 ) : (
 pastBookings.map((b: any) => <BookingCard key={b.id} booking={b} />)
 )}
 </TabsContent>

 <TabsContent value="cancelled" className="space-y-3">
 {cancelledBookings.length === 0 ? (
 <EmptyState message="No cancelled bookings" />
 ) : (
 cancelledBookings.map((b: any) => <BookingCard key={b.id} booking={b} />)
 )}
 </TabsContent>
 </>
 )}
 </Tabs>
 </div>

 {/* Cancel Dialog */}
 <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
 <AlertDialogDescription>
 This will cancel your {selectedBooking?.merchant_services?.name} appointment on{""}
 {selectedBooking && format(parseLocalDate(selectedBooking.booking_date),"MMM d, yyyy")}.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <Textarea
 placeholder="Reason for cancellation (optional)..."
 value={cancelReason}
 onChange={(e) => setCancelReason(e.target.value)}
 rows={2}
 />
 <AlertDialogFooter>
 <AlertDialogCancel>Keep Booking</AlertDialogCancel>
 <AlertDialogAction
 className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
 onClick={() =>
 selectedBooking && cancelBooking.mutate({ id: selectedBooking.id, reason: cancelReason })
 }
 >
 {cancelBooking.isPending ?"Cancelling..." :"Yes, Cancel"}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}
