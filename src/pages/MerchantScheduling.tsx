import { sendBookingEmail } from "@/lib/sendBookingEmail";
import { createAppNotification } from "@/lib/createAppNotification";
import { useState, useEffect, useCallback } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { getNormalizedCategory } from"@/lib/categoryMapping";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Badge } from"@/components/ui/badge";
import { Calendar, Clock, Compass, Dog, Loader2, Plus, Settings, Users, Zap } from "lucide-react";
import { toast } from"sonner";
import { ServicesList } from"@/components/scheduling/ServicesList";
import { AvailabilityManager } from"@/components/scheduling/AvailabilityManager";
import { Label } from"@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { TIMEZONE_OPTIONS, DEFAULT_MERCHANT_TZ } from"@/lib/timezone";
import { BookingsCalendar } from"@/components/scheduling/BookingsCalendar";
import { ServiceDialog } from"@/components/scheduling/ServiceDialog";
import { FlashSaleDialog } from"@/components/scheduling/FlashSaleDialog";
import { IntakeQuestionsManager } from"@/components/scheduling/IntakeQuestionsManager";
import { GroomingSettingsTab } from"@/components/scheduling/GroomingSettingsTab";
import { SmartScheduleTab } from"@/components/scheduling/SmartScheduleTab";
import { ExternalCalendarSettings } from"@/components/scheduling/ExternalCalendarSettings";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { 
 schedulingService, 
 type MerchantService, 
 type MerchantAvailability, 
 type AvailabilityOverride,
 type BookingWithDetails,
 isFlashSaleActive
} from"@/services/api/scheduling.service";

const MerchantScheduling = () => {
 const { user, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const [merchantId, setMerchantId] = useState<string | null>(null);
 const [businessType, setBusinessType] = useState<string>("");
  const [timezone, setTimezone] = useState<string>(DEFAULT_MERCHANT_TZ);
  const [savingTz, setSavingTz] = useState(false);
 const [loading, setLoading] = useState(true);
 const [services, setServices] = useState<MerchantService[]>([]);
 const [availability, setAvailability] = useState<MerchantAvailability[]>([]);
 const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
 const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
 const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
 const [flashSaleDialogOpen, setFlashSaleDialogOpen] = useState(false);
 const [editingService, setEditingService] = useState<MerchantService | null>(null);
 const [flashSaleService, setFlashSaleService] = useState<MerchantService | null>(null);
 const [activeTab, setActiveTab] = useState("services");

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 const loadData = useCallback(async () => {
 if (!user) return;

 try {
 // Get merchant ID
 const { data: merchant, error: merchantError } = await supabase
 .from("merchants")
        .select("id, business_type, timezone")
 .eq("user_id", user.id)
 .single();

 if (merchantError) {
 if (merchantError.code ==="PGRST116") {
 navigate("/merchant-onboarding");
 return;
 }
 throw merchantError;
 }

 setMerchantId(merchant.id);
 setBusinessType(merchant.business_type ||"");
      setTimezone((merchant as any).timezone || DEFAULT_MERCHANT_TZ);

 // Load all scheduling data in parallel
 const [servicesData, availabilityData, overridesData, bookingsData] = await Promise.all([
 schedulingService.getServices(merchant.id),
 schedulingService.getAvailability(merchant.id),
 schedulingService.getOverrides(merchant.id),
 schedulingService.getMerchantBookings(merchant.id),
 ]);

 setServices(servicesData);
 setAvailability(availabilityData);
 setOverrides(overridesData);
 setBookings(bookingsData);
 } catch (error) {
 console.error("Error loading scheduling data:", error);
 toast.error("Failed to load scheduling data");
 } finally {
 setLoading(false);
 }
 }, [user, navigate]);

 useEffect(() => {
 if (user) {
 loadData();
 }
 }, [user, loadData]);

 const handleCreateService = async (data: Omit<MerchantService,'id' |'created_at' |'updated_at' |'merchant_id'>) => {
 if (!merchantId) return;
 
 try {
 await schedulingService.createService({ ...data, merchant_id: merchantId });
 toast.success("Service created successfully!");
 setServiceDialogOpen(false);
 loadData();
 } catch (error) {
 console.error("Error creating service:", error);
 toast.error("Failed to create service");
 }
 };

 const handleUpdateService = async (id: string, data: Partial<MerchantService>) => {
 try {
 await schedulingService.updateService(id, data);
 toast.success("Service updated successfully!");
 setEditingService(null);
 loadData();
 } catch (error) {
 console.error("Error updating service:", error);
 toast.error("Failed to update service");
 }
 };

 const handleDeleteService = async (id: string) => {
 try {
 await schedulingService.deleteService(id);
 toast.success("Service deleted successfully!");
 loadData();
 } catch (error) {
 console.error("Error deleting service:", error);
 toast.error("Failed to delete service");
 }
 };

 const handleUpdateAvailability = async (data: MerchantAvailability[]) => {
 setAvailability(data);
 };

 const handleUpdateOverrides = async (data: AvailabilityOverride[]) => {
 setOverrides(data);
 };

 const handleUpdateBookingStatus = async (bookingId: string, status:'confirmed' |'cancelled' |'completed' |'no_show') => {
 try {
 await schedulingService.updateBookingStatus(bookingId, status);

 // Find the booking to notify the customer
 const booking = bookings.find(b => b.id === bookingId);
 if (booking && (status ==='confirmed' || status ==='cancelled')) {
 const serviceName = booking.merchant_services?.name ||'your service';
 const bookingDate = booking.booking_date;

 // Create in-app notification for customer
 const title = status ==='confirmed'
 ?'Booking Confirmed!'
 :'Booking Declined';
 const message = status ==='confirmed'
 ? `Your ${serviceName} appointment on ${bookingDate} has been confirmed!`
 : `Your ${serviceName} appointment request for ${bookingDate} was declined. Please try a different time or contact the business.`;

 await createAppNotification({
 user_id: booking.user_id,
 title,
 message,
 category:'transactional',
 is_read: false,
 }).then(({ error }) => {
 if (error) console.error("Failed to create customer notification:", error);
 });

 // Send email notification to customer
 if (booking.customer_email) {
 sendBookingEmail({
 type: status ==='confirmed' ?'confirmation' :'cancellation',
 bookingId: booking.id,
 initiator:'merchant',
 customerEmail: booking.customer_email,
 customerName: booking.customer_name || booking.customer_email,
 merchantName: (booking as any).merchant_services?.merchants?.business_name ||'the business',
 serviceName,
 bookingDate,
 startTime: booking.start_time,
 endTime: booking.end_time,
 totalPrice: booking.total_price,
 ...(status ==='cancelled' ? { cancellationReason:'Declined by business' } : {}),
 },
 });
 }
 }

 toast.success(`Booking ${status ==='confirmed' ?'accepted' : status}!`);
 loadData();
 } catch (error) {
 console.error("Error updating booking:", error);
 toast.error("Failed to update booking");
 }
 };

 if (authLoading || loading) {
 return (
 <MerchantWorkspaceLayout>
   <WorkspacePageHeader section="Catalog & Services" title="Scheduling" subtitle="Manage services & bookings" />
   <div className="flex items-center justify-center py-24">
     <Loader2 className="w-8 h-8 animate-spin text-primary" />
   </div>
 </MerchantWorkspaceLayout>
 );
 }

 const pendingBookings = bookings.filter(b => b.status ==='pending').length;
 const todayBookings = bookings.filter(b => {
 const today = new Date().toISOString().split('T')[0];
 return b.booking_date === today && b.status !=='cancelled';
 }).length;

 return (
 <MerchantWorkspaceLayout>
   <SEO title="Scheduling · Merchant Workspace" description="Manage your pet services, set availability, and view customer bookings" />
   <WorkspacePageHeader
     section="Catalog & Services"
     title="Scheduling"
     subtitle="Manage services & bookings"
     actions={
       <>
         {pendingBookings > 0 && (
           <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
             {pendingBookings} pending
           </Badge>
         )}
         <Button onClick={() => setServiceDialogOpen(true)} size="sm">
           <Plus className="w-4 h-4 mr-1" />
           Add Service
         </Button>
       </>
     }
   />
   <main className="p-4 md:p-6 max-w-7xl mx-auto w-full">
 {/* Quick Stats */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <GradientCard className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-lg">
 <Settings className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="text-2xl font-bold">{services.length}</p>
 <p className="text-xs text-muted-foreground">Services</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-accent/10 rounded-lg">
 <Calendar className="w-5 h-5 text-accent" aria-hidden="true" />
 </div>
 <div>
 <p className="text-2xl font-bold">{todayBookings}</p>
 <p className="text-xs text-muted-foreground">Today</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-warning/10 rounded-lg">
 <Clock className="w-5 h-5 text-warning" aria-hidden="true" />
 </div>
 <div>
 <p className="text-2xl font-bold">{pendingBookings}</p>
 <p className="text-xs text-muted-foreground">Pending</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-success/10 rounded-lg">
 <Users className="w-5 h-5 text-success" aria-hidden="true" />
 </div>
 <div>
 <p className="text-2xl font-bold">{bookings.filter(b => b.status ==='completed').length}</p>
 <p className="text-xs text-muted-foreground">Completed</p>
 </div>
 </div>
 </GradientCard>
 {/* Flash Sales Active Stat */}
 <GradientCard className="p-4 md:col-span-1 col-span-2">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-warning/10 rounded-lg">
 <Zap className="w-5 h-5 text-warning" aria-hidden="true" />
 </div>
 <div>
 <p className="text-2xl font-bold">{services.filter(s => isFlashSaleActive(s)).length}</p>
 <p className="text-xs text-muted-foreground">Active Flash Sales</p>
 </div>
 </div>
 </GradientCard>
 </div>

 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="mb-6 flex-wrap">
 <TabsTrigger value="services">Services</TabsTrigger>
 <TabsTrigger value="availability">Availability</TabsTrigger>
 <TabsTrigger value="bookings">Bookings</TabsTrigger>
 <TabsTrigger value="routes" className="gap-1">
 <Compass className="w-3.5 h-3.5" aria-hidden="true" />
 Routes
 </TabsTrigger>
 <TabsTrigger value="intake">Intake Forms</TabsTrigger>
 <TabsTrigger value="calendars">Calendar Sync</TabsTrigger>
 {getNormalizedCategory(businessType) ==='grooming' && (
 <TabsTrigger value="grooming" className="gap-1">
 <Dog className="w-3.5 h-3.5" aria-hidden="true" />
 Grooming
 </TabsTrigger>
 )}
 </TabsList>

 <TabsContent value="services">
 <ServicesList
 services={services}
 onEdit={(service) => {
 setEditingService(service);
 setServiceDialogOpen(true);
 }}
 onDelete={handleDeleteService}
 onToggleActive={(id, active) => handleUpdateService(id, { is_active: active })}
 onManageFlashSale={(service) => {
 setFlashSaleService(service);
 setFlashSaleDialogOpen(true);
 }}
 />
 </TabsContent>

 <TabsContent value="availability">
          <GradientCard className="p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <Label className="text-sm font-semibold">Business timezone</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All availability hours, slots, and booking reminders use this timezone. Pet owners
                  in other timezones will also see their local equivalent.
                </p>
              </div>
              <Select
                value={timezone}
                disabled={savingTz}
                onValueChange={async (tz) => {
                  if (!merchantId || tz === timezone) return;
                  setSavingTz(true);
                  const prev = timezone;
                  setTimezone(tz);
                  const { error } = await supabase
                    .from("merchants")
                    .update({ timezone: tz })
                    .eq("id", merchantId);
                  setSavingTz(false);
                  if (error) {
                    setTimezone(prev);
                    toast.error("Failed to update timezone");
                  } else {
                    toast.success("Timezone updated");
                  }
                }}
              >
                <SelectTrigger className="sm:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </GradientCard>
 <AvailabilityManager
 merchantId={merchantId!}
 availability={availability}
 overrides={overrides}
 onAvailabilityUpdate={handleUpdateAvailability}
 onOverridesUpdate={handleUpdateOverrides}
 onRefresh={loadData}
 />
 </TabsContent>

 <TabsContent value="bookings">
 <BookingsCalendar
 bookings={bookings}
 merchantId={merchantId || undefined}
 onUpdateStatus={handleUpdateBookingStatus}
 />
 </TabsContent>

 <TabsContent value="intake">
 {merchantId && (
 <IntakeQuestionsManager
 merchantId={merchantId}
 services={services.map(s => ({ id: s.id, name: s.name }))}
 />
 )}
 </TabsContent>

 <TabsContent value="routes">
 {merchantId && (
 <SmartScheduleTab merchantId={merchantId} />
 )}
 </TabsContent>

 <TabsContent value="calendars">
 {merchantId && <ExternalCalendarSettings merchantId={merchantId} />}
 </TabsContent>

 {getNormalizedCategory(businessType) ==='grooming' && merchantId && (
 <TabsContent value="grooming">
 <GroomingSettingsTab merchantId={merchantId} />
 </TabsContent>
 )}
 </Tabs>
 </main>

 <ServiceDialog
 open={serviceDialogOpen}
 onOpenChange={(open) => {
 setServiceDialogOpen(open);
 if (!open) setEditingService(null);
 }}
 service={editingService}
 merchantId={merchantId}
 onSubmit={editingService 
 ? (data) => handleUpdateService(editingService.id, data)
 : handleCreateService
 }
 />

 <FlashSaleDialog
 open={flashSaleDialogOpen}
 onOpenChange={(open) => {
 setFlashSaleDialogOpen(open);
 if (!open) setFlashSaleService(null);
 }}
 service={flashSaleService}
 onUpdate={async (id, data) => {
 await handleUpdateService(id, data);
 // Send notification if flash sale is being activated
 if (data.is_flash_sale && data.flash_sale_pawbucks_price && merchantId) {
 try {
 await supabase.functions.invoke('send-flash-sale-notification', {
 body: { serviceId: id, merchantId }
 });
 toast.success("Flash sale notification sent to pet owners!");
 } catch (error) {
 console.error("Error sending flash sale notification:", error);
 }
 }
 }}
 />
 </MerchantWorkspaceLayout>
 );
};

export default MerchantScheduling;
