import { useState, useMemo } from"react";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Badge } from"@/components/ui/badge";
import { Calendar } from"@/components/ui/calendar";
import { 
 Select, 
 SelectContent, 
 SelectItem, 
 SelectTrigger, 
 SelectValue 
} from"@/components/ui/select";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { format, isSameDay, startOfToday } from"date-fns";
import { parseLocalDate } from'@/utils/formatters';
import { 
 CheckCircle, 
 XCircle, 
 Clock, 
 User, 
 Phone, 
 Mail,
 PawPrint,
 Calendar as CalendarIcon,
 AlertCircle,
 CreditCard,
 Loader2,
 DollarSign,
} from"lucide-react";
import { type BookingWithDetails, type BookingStatus } from"@/services/api/scheduling.service";
import { GroomingReportCardForm } from"./GroomingReportCardForm";
import { FileText } from"lucide-react";
import { supabase } from"@/integrations/supabase/client";
import { toast } from"sonner";

interface BookingsCalendarProps {
 bookings: BookingWithDetails[];
 merchantId?: string;
 onUpdateStatus: (id: string, status:'confirmed' |'cancelled' |'completed' |'no_show') => void;
}

const STATUS_COLORS: Record<BookingStatus, string> = {
 pending:'bg-warning/100/10 text-warning border-warning/200/20',
 confirmed:'bg-info/100/10 text-info border-info/200/20',
 cancelled:'bg-muted text-muted-foreground border-border',
 completed:'bg-success/100/10 text-success border-success/200/20',
 no_show:'bg-destructive/100/10 text-destructive border-destructive/200/20',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
 pending:'Pending',
 confirmed:'Confirmed',
 cancelled:'Cancelled',
 completed:'Completed',
 no_show:'No Show',
};

// No-Show Fee Charge Button
function NoShowChargeButton({ booking, onCharged }: { booking: BookingWithDetails; onCharged: () => void }) {
 const [charging, setCharging] = useState(false);
 const [charged, setCharged] = useState(false);

 const feeAmount = (booking.merchant_services as any)?.no_show_fee_amount || (booking as any).deposit_amount || 0;

 const handleCharge = async () => {
 if (!window.confirm(`Charge $${feeAmount.toFixed(2)} no-show fee to this client's card on file?`)) return;
 
 setCharging(true);
 try {
 const { data, error } = await supabase.functions.invoke("charge-no-show-fee", {
 body: { bookingId: booking.id, reason:"Client did not show up for appointment" },
 });

 if (error) throw error;
 if (data?.error) throw new Error(data.error);

 toast.success(`No-show fee of $${data.chargeAmount.toFixed(2)} charged successfully`);
 setCharged(true);
 onCharged();
 } catch (err: any) {
 toast.error(err.message ||"Failed to charge no-show fee");
 } finally {
 setCharging(false);
 }
 };

 if (charged) {
 return (
 <div className="pt-4 border-t">
 <div className="flex items-center gap-2 p-3 rounded-lg bg-success/100/10 text-success text-sm">
 <CheckCircle className="w-4 h-4" />
 <span>No-show fee charged successfully</span>
 </div>
 </div>
 );
 }

 return (
 <div className="pt-4 border-t space-y-2">
 <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/100/10 text-warning text-xs">
 <CreditCard className="w-3.5 h-3.5 flex-shrink-0" />
 <span>Card on file available — charge no-show fee</span>
 </div>
 <Button
 variant="destructive"
 className="w-full gap-2"
 onClick={handleCharge}
 disabled={charging || feeAmount <= 0}
 >
 {charging ? (
 <><Loader2 className="w-4 h-4 animate-spin" /> Charging...</>
 ) : (
 <><DollarSign className="w-4 h-4" /> Charge ${feeAmount.toFixed(2)} No-Show Fee</>
 )}
 </Button>
 </div>
 );
}

export function BookingsCalendar({ bookings, merchantId, onUpdateStatus }: BookingsCalendarProps) {
 const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
 const [statusFilter, setStatusFilter] = useState<BookingStatus |'all'>('all');
 const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
 const [reportCardBooking, setReportCardBooking] = useState<BookingWithDetails | null>(null);

 // Get dates that have bookings
 const datesWithBookings = useMemo(() => {
 const dates = new Set<string>();
 bookings.forEach(b => {
 if (b.status !=='cancelled') {
 dates.add(b.booking_date);
 }
 });
 return dates;
 }, [bookings]);

 // Filter bookings for selected date
 const filteredBookings = useMemo(() => {
 const dateStr = format(selectedDate,'yyyy-MM-dd');
 return bookings
 .filter(b => b.booking_date === dateStr)
 .filter(b => statusFilter ==='all' || b.status === statusFilter)
 .sort((a, b) => a.start_time.localeCompare(b.start_time));
 }, [bookings, selectedDate, statusFilter]);

 const formatTime = (time: string) => {
 const [hours, minutes] = time.split(':');
 const h = parseInt(hours);
 const ampm = h >= 12 ?'PM' :'AM';
 const hour12 = h % 12 || 12;
 return `${hour12}:${minutes} ${ampm}`;
 };

 return (
 <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
 {/* Calendar Sidebar */}
 <div className="space-y-4">
 <GradientCard className="p-3">
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={(date) => date && setSelectedDate(date)}
 modifiers={{
 hasBookings: (date) => datesWithBookings.has(format(date,'yyyy-MM-dd')),
 }}
 modifiersStyles={{
 hasBookings: {
 fontWeight:'bold',
 textDecoration:'underline',
 textDecorationColor:'hsl(var(--primary))',
 },
 }}
 />
 </GradientCard>

 <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BookingStatus |'all')}>
 <SelectTrigger>
 <SelectValue placeholder="Filter by status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Bookings</SelectItem>
 {(Object.entries(STATUS_LABELS) as [BookingStatus, string][]).map(([value, label]) => (
 <SelectItem key={value} value={value}>{label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Bookings List */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold text-lg">
 {format(selectedDate,'EEEE, MMMM d, yyyy')}
 </h3>
 <Badge variant="secondary">
 {filteredBookings.length} booking{filteredBookings.length !== 1 ?'s' :''}
 </Badge>
 </div>

 {filteredBookings.length === 0 ? (
 <GradientCard className="p-8 text-center">
 <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
 <p className="text-muted-foreground">No bookings for this date</p>
 </GradientCard>
 ) : (
 <div className="space-y-3">
 {filteredBookings.map((booking) => (
 <GradientCard 
 key={booking.id} 
 className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
 onClick={() => setSelectedBooking(booking)}
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-2">
 <span className="font-medium">
 {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
 </span>
 <Badge variant="outline" className={STATUS_COLORS[booking.status]}>
 {STATUS_LABELS[booking.status]}
 </Badge>
 </div>
 
 <p className="font-semibold mb-1">
 {booking.merchant_services?.name ||'Unknown Service'}
 </p>
 
 <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
 {booking.customer_name && (
 <span className="flex items-center gap-1">
 <User className="w-3 h-3" />
 {booking.customer_name}
 </span>
 )}
 {booking.pet_profiles && (
 <span className="flex items-center gap-1">
 <PawPrint className="w-3 h-3" />
 {booking.pet_profiles.name}
 </span>
 )}
 </div>
 </div>

 <div className="text-right">
 <p className="font-semibold">${booking.total_price.toFixed(2)}</p>
 <Badge variant="outline" className="text-xs mt-1">
 {booking.payment_status ==='paid' ?'Paid' :'Unpaid'}
 </Badge>
 </div>
 </div>
 </GradientCard>
 ))}
 </div>
 )}
 </div>

 {/* Booking Details Dialog */}
 <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Booking Details</DialogTitle>
 </DialogHeader>

 {selectedBooking && (
 <div className="space-y-4">
 <div className="flex items-center gap-2">
 <Badge variant="outline" className={STATUS_COLORS[selectedBooking.status]}>
 {STATUS_LABELS[selectedBooking.status]}
 </Badge>
 <Badge variant="outline">
 {selectedBooking.payment_status ==='paid' ?'Paid' :'Payment Pending'}
 </Badge>
 </div>

 <div className="space-y-3">
 <div>
 <p className="text-sm text-muted-foreground">Service</p>
 <p className="font-medium">{selectedBooking.merchant_services?.name}</p>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <p className="text-sm text-muted-foreground">Date</p>
 <p className="font-medium flex items-center gap-1">
 <CalendarIcon className="w-4 h-4" />
 {format(parseLocalDate(selectedBooking.booking_date),'MMM d, yyyy')}
 </p>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Time</p>
 <p className="font-medium flex items-center gap-1">
 <Clock className="w-4 h-4" />
 {formatTime(selectedBooking.start_time)} - {formatTime(selectedBooking.end_time)}
 </p>
 </div>
 </div>

 <div>
 <p className="text-sm text-muted-foreground">Customer</p>
 <div className="space-y-1">
 {selectedBooking.customer_name && (
 <p className="font-medium flex items-center gap-2">
 <User className="w-4 h-4" />
 {selectedBooking.customer_name}
 </p>
 )}
 {selectedBooking.customer_phone && (
 <p className="text-sm flex items-center gap-2">
 <Phone className="w-4 h-4" />
 {selectedBooking.customer_phone}
 </p>
 )}
 {selectedBooking.customer_email && (
 <p className="text-sm flex items-center gap-2">
 <Mail className="w-4 h-4" />
 {selectedBooking.customer_email}
 </p>
 )}
 </div>
 </div>

 {selectedBooking.pet_profiles && (
 <div>
 <p className="text-sm text-muted-foreground">Pet</p>
 <p className="font-medium flex items-center gap-2">
 <PawPrint className="w-4 h-4" />
 {selectedBooking.pet_profiles.name} ({selectedBooking.pet_profiles.type})
 </p>
 </div>
 )}

 {selectedBooking.notes && (
 <div>
 <p className="text-sm text-muted-foreground">Notes</p>
 <p className="text-sm">{selectedBooking.notes}</p>
 </div>
 )}

 <div>
 <p className="text-sm text-muted-foreground">Total</p>
 <p className="text-lg font-bold">${selectedBooking.total_price.toFixed(2)}</p>
 </div>
 </div>

 {/* Action Buttons */}
 {selectedBooking.status ==='pending' && (
 <div className="flex gap-2 pt-4 border-t">
 <Button 
 variant="outline" 
 className="flex-1"
 onClick={() => {
 onUpdateStatus(selectedBooking.id,'cancelled');
 setSelectedBooking(null);
 }}
 >
 <XCircle className="w-4 h-4 mr-2" />
 Decline
 </Button>
 <Button 
 className="flex-1"
 onClick={() => {
 onUpdateStatus(selectedBooking.id,'confirmed');
 setSelectedBooking(null);
 }}
 >
 <CheckCircle className="w-4 h-4 mr-2" />
 Accept
 </Button>
 </div>
 )}

 {selectedBooking.status ==='confirmed' && (
 <div className="space-y-2 pt-4 border-t">
 <div className="flex gap-2">
 <Button 
 variant="outline" 
 className="flex-1"
 onClick={() => {
 onUpdateStatus(selectedBooking.id,'no_show');
 setSelectedBooking(null);
 }}
 >
 <AlertCircle className="w-4 h-4 mr-2" />
 No Show
 </Button>
 <Button 
 className="flex-1"
 onClick={() => {
 onUpdateStatus(selectedBooking.id,'completed');
 setSelectedBooking(null);
 }}
 >
 <CheckCircle className="w-4 h-4 mr-2" />
 Complete
 </Button>
 </div>
 </div>
 )}

 {/* No-Show Fee Charge Button */}
 {selectedBooking.status ==='no_show' && (selectedBooking as any).stripe_payment_method_id && (
 <NoShowChargeButton
 booking={selectedBooking}
 onCharged={() => {
 setSelectedBooking(null);
 }}
 />
 )}

 {selectedBooking.status ==='no_show' && !(selectedBooking as any).stripe_payment_method_id && (
 <div className="pt-4 border-t">
 <p className="text-sm text-muted-foreground text-center">
 No card on file — cannot charge no-show fee.
 </p>
 </div>
 )}

 {selectedBooking.status ==='completed' && merchantId && (
 <div className="pt-4 border-t">
 <Button
 variant="outline"
 className="w-full gap-2"
 onClick={() => {
 setReportCardBooking(selectedBooking);
 setSelectedBooking(null);
 }}
 >
 <FileText className="w-4 h-4" />
 Grooming Report Card
 </Button>
 </div>
 )}
 </div>
 )}
 </DialogContent>
 </Dialog>

 {/* Grooming Report Card Dialog */}
 <Dialog open={!!reportCardBooking} onOpenChange={() => setReportCardBooking(null)}>
 <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Grooming Report Card</DialogTitle>
 </DialogHeader>
 {reportCardBooking && merchantId && (
 <GroomingReportCardForm
 bookingId={reportCardBooking.id}
 merchantId={merchantId}
 petId={(reportCardBooking as any).pet_id || null}
 petName={(reportCardBooking as any).pet_profiles?.name || null}
 customerUserId={(reportCardBooking as any).user_id}
 customerName={reportCardBooking.customer_name || undefined}
 serviceName={reportCardBooking.merchant_services?.name || undefined}
 onClose={() => setReportCardBooking(null)}
 />
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}
