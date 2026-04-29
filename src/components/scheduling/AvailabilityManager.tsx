import { useState } from"react";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Switch } from"@/components/ui/switch";
import { Input } from"@/components/ui/input";
import { Badge } from"@/components/ui/badge";
import { Calendar } from"@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from"@/components/ui/popover";
import { Label } from"@/components/ui/label";
import { 
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from"@/components/ui/dialog";
import { CalendarIcon, Plus, X, Clock } from"lucide-react";
import { format } from"date-fns";
import { parseLocalDate } from'@/utils/formatters';
import { toast } from"sonner";
import { 
 schedulingService,
 type MerchantAvailability, 
 type AvailabilityOverride,
 DAY_LABELS 
} from"@/services/api/scheduling.service";

interface AvailabilityManagerProps {
 merchantId: string;
 availability: MerchantAvailability[];
 overrides: AvailabilityOverride[];
 onAvailabilityUpdate: (data: MerchantAvailability[]) => void;
 onOverridesUpdate: (data: AvailabilityOverride[]) => void;
 onRefresh: () => void;
}

const DEFAULT_START ="09:00";
const DEFAULT_END ="17:00";

export function AvailabilityManager({ 
 merchantId, 
 availability, 
 overrides, 
 onRefresh 
}: AvailabilityManagerProps) {
 const [loading, setLoading] = useState(false);
 const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
 const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
 const [overrideType, setOverrideType] = useState<'block' |'custom'>('block');
 const [customStart, setCustomStart] = useState(DEFAULT_START);
 const [customEnd, setCustomEnd] = useState(DEFAULT_END);
 const [overrideReason, setOverrideReason] = useState('');

 const getAvailabilityForDay = (dayOfWeek: number) => {
 return availability.find(a => a.day_of_week === dayOfWeek);
 };

 const handleToggleDay = async (dayOfWeek: number, enabled: boolean) => {
 setLoading(true);
 try {
 const existing = getAvailabilityForDay(dayOfWeek);
 
 if (existing) {
 await schedulingService.updateAvailability(existing.id, { is_active: enabled });
 } else if (enabled) {
 await schedulingService.setAvailability({
 merchant_id: merchantId,
 day_of_week: dayOfWeek,
 start_time: DEFAULT_START +':00',
 end_time: DEFAULT_END +':00',
 slot_duration_minutes: 60,
 is_active: true,
 });
 }
 
 onRefresh();
 } catch (error) {
 console.error("Error updating availability:", error);
 toast.error("Failed to update availability");
 } finally {
 setLoading(false);
 }
 };

 const handleUpdateHours = async (dayOfWeek: number, startTime: string, endTime: string) => {
 const existing = getAvailabilityForDay(dayOfWeek);
 if (!existing) return;

 setLoading(true);
 try {
 await schedulingService.updateAvailability(existing.id, {
 start_time: startTime +':00',
 end_time: endTime +':00',
 });
 onRefresh();
 toast.success("Hours updated");
 } catch (error) {
 console.error("Error updating hours:", error);
 toast.error("Failed to update hours");
 } finally {
 setLoading(false);
 }
 };

 const handleAddOverride = async () => {
 if (!selectedDate) return;

 setLoading(true);
 try {
 await schedulingService.setOverride({
 merchant_id: merchantId,
 override_date: format(selectedDate,'yyyy-MM-dd'),
 is_available: overrideType ==='custom',
 start_time: overrideType ==='custom' ? customStart +':00' : undefined,
 end_time: overrideType ==='custom' ? customEnd +':00' : undefined,
 reason: overrideReason || undefined,
 });

 toast.success(overrideType ==='block' ?'Date blocked' :'Custom hours set');
 setOverrideDialogOpen(false);
 setSelectedDate(undefined);
 setOverrideReason('');
 onRefresh();
 } catch (error) {
 console.error("Error adding override:", error);
 toast.error("Failed to add date override");
 } finally {
 setLoading(false);
 }
 };

 const handleDeleteOverride = async (id: string) => {
 setLoading(true);
 try {
 await schedulingService.deleteOverride(id);
 toast.success("Override removed");
 onRefresh();
 } catch (error) {
 console.error("Error deleting override:", error);
 toast.error("Failed to remove override");
 } finally {
 setLoading(false);
 }
 };

 // Filter to show only future overrides
 const futureOverrides = overrides.filter(o => new Date(o.override_date) >= new Date());

 return (
 <div className="space-y-6">
 {/* Weekly Schedule */}
 <GradientCard className="p-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold flex items-center gap-2">
 <Clock className="w-4 h-4" />
 Weekly Schedule
 </h3>
 </div>

 <div className="space-y-3">
 {DAY_LABELS.map((day, index) => {
 const dayAvail = getAvailabilityForDay(index);
 const isActive = dayAvail?.is_active ?? false;

 return (
 <div 
 key={day} 
 className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
 >
 <Switch
 checked={isActive}
 onCheckedChange={(checked) => handleToggleDay(index, checked)}
 disabled={loading}
 />
 <span className="w-24 font-medium">{day}</span>
 
 {isActive && dayAvail ? (
 <div className="flex items-center gap-2 flex-1">
 <Input
 type="time"
 value={dayAvail.start_time.slice(0, 5)}
 onChange={(e) => handleUpdateHours(index, e.target.value, dayAvail.end_time.slice(0, 5))}
 className="w-28"
 disabled={loading}
 />
 <span className="text-muted-foreground">to</span>
 <Input
 type="time"
 value={dayAvail.end_time.slice(0, 5)}
 onChange={(e) => handleUpdateHours(index, dayAvail.start_time.slice(0, 5), e.target.value)}
 className="w-28"
 disabled={loading}
 />
 </div>
 ) : (
 <span className="text-muted-foreground text-sm">Closed</span>
 )}
 </div>
 );
 })}
 </div>
 </GradientCard>

 {/* Date Overrides */}
 <GradientCard className="p-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold flex items-center gap-2">
 <CalendarIcon className="w-4 h-4" />
 Date Exceptions
 </h3>
 <Button 
 size="sm" 
 variant="outline" 
 onClick={() => setOverrideDialogOpen(true)}
 >
 <Plus className="w-4 h-4 mr-1" />
 Add Date
 </Button>
 </div>

 {futureOverrides.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-4">
 No date exceptions set. Add blocked days or custom hours for specific dates.
 </p>
 ) : (
 <div className="space-y-2">
 {futureOverrides.map((override) => (
 <div 
 key={override.id}
 className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
 >
 <div className="flex items-center gap-3">
 <Badge variant={override.is_available ?"secondary" :"destructive"}>
 {override.is_available ?'Custom Hours' :'Blocked'}
 </Badge>
 <span className="font-medium">
 {format(parseLocalDate(override.override_date),'EEE, MMM d, yyyy')}
 </span>
 {override.is_available && override.start_time && (
 <span className="text-sm text-muted-foreground">
 {override.start_time.slice(0, 5)} - {override.end_time?.slice(0, 5)}
 </span>
 )}
 {override.reason && (
 <span className="text-sm text-muted-foreground">
 ({override.reason})
 </span>
 )}
 </div>
 <Button 
 variant="ghost" 
 size="icon"
 onClick={() => handleDeleteOverride(override.id)}
 disabled={loading}
 >
 <X className="w-4 h-4" />
 </Button>
 </div>
 ))}
 </div>
 )}
 </GradientCard>

 {/* Add Override Dialog */}
 <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Add Date Exception</DialogTitle>
 </DialogHeader>

 <div className="space-y-4">
 <div>
 <Label className="mb-2 block">Select Date</Label>
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" className="w-full justify-start">
 <CalendarIcon className="w-4 h-4 mr-2" />
 {selectedDate ? format(selectedDate,'PPP') :'Pick a date'}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={setSelectedDate}
 disabled={(date) => date < new Date()}
 initialFocus
 />
 </PopoverContent>
 </Popover>
 </div>

 <div>
 <Label className="mb-2 block">Type</Label>
 <div className="flex gap-2">
 <Button
 type="button"
 variant={overrideType ==='block' ?'default' :'outline'}
 onClick={() => setOverrideType('block')}
 className="flex-1"
 >
 Block Day
 </Button>
 <Button
 type="button"
 variant={overrideType ==='custom' ?'default' :'outline'}
 onClick={() => setOverrideType('custom')}
 className="flex-1"
 >
 Custom Hours
 </Button>
 </div>
 </div>

 {overrideType ==='custom' && (
 <div className="flex items-center gap-2">
 <div className="flex-1">
 <Label className="mb-1 block text-sm">Start</Label>
 <Input
 type="time"
 value={customStart}
 onChange={(e) => setCustomStart(e.target.value)}
 />
 </div>
 <div className="flex-1">
 <Label className="mb-1 block text-sm">End</Label>
 <Input
 type="time"
 value={customEnd}
 onChange={(e) => setCustomEnd(e.target.value)}
 />
 </div>
 </div>
 )}

 <div>
 <Label className="mb-1 block">Reason (optional)</Label>
 <Input
 placeholder="e.g., Holiday, Training day..."
 value={overrideReason}
 onChange={(e) => setOverrideReason(e.target.value)}
 />
 </div>
 </div>

 <DialogFooter>
 <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
 Cancel
 </Button>
 <Button onClick={handleAddOverride} disabled={!selectedDate || loading}>
 {loading ?'Saving...' :'Add Exception'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
