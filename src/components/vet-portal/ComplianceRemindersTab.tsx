import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Switch } from"@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from"@/components/ui/dialog";
import { Badge } from"@/components/ui/badge";
import { Plus, Trash2, Edit, Send, Loader2 } from "lucide-react";
import { format, parseISO, addMonths } from"date-fns";
import { toast } from"sonner";

type Pet = {
 id: string;
 name: string;
 type: string;
 user_id: string;
};

type Reminder = {
 id: string;
 pet_id: string;
 reminder_type: string;
 title: string;
 description: string | null;
 due_date: string;
 recurrence_months: number | null;
 is_active: boolean;
 sms_enabled: boolean;
 push_enabled: boolean;
 last_sent_at: string | null;
 next_reminder_at: string | null;
 created_at: string;
 pet?: Pet;
};

type ComplianceRemindersTabProps = {
 vetId: string;
};

const REMINDER_TYPES = [
 { value:"vaccination", label:"Vaccination" },
 { value:"heartworm_test", label:"Heartworm Test" },
 { value:"annual_exam", label:"Annual Exam" },
 { value:"dental_cleaning", label:"Dental Cleaning" },
 { value:"flea_tick", label:"Flea & Tick Prevention" },
 { value:"other", label:"Other" },
];

const RECURRENCE_OPTIONS = [
 { value:"0", label:"One-time (no recurrence)" },
 { value:"1", label:"Monthly" },
 { value:"3", label:"Every 3 months" },
 { value:"6", label:"Every 6 months" },
 { value:"12", label:"Yearly" },
];

export const ComplianceRemindersTab = ({ vetId }: ComplianceRemindersTabProps) => {
 const [reminders, setReminders] = useState<Reminder[]>([]);
 const [patients, setPatients] = useState<Pet[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isDialogOpen, setIsDialogOpen] = useState(false);
 const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
 const [isSaving, setIsSaving] = useState(false);
 const [isSending, setIsSending] = useState<string | null>(null);

 const [formData, setFormData] = useState({
 pet_id:"",
 reminder_type:"vaccination",
 title:"",
 description:"",
 due_date: format(new Date(),"yyyy-MM-dd"),
 recurrence_months:"0",
 sms_enabled: true,
 push_enabled: true,
 });

 useEffect(() => {
 loadReminders();
 loadPatients();
 }, [vetId]);

 const loadReminders = async () => {
 try {
 const { data, error } = await supabase
 .from("compliance_reminders")
 .select(`
 *,
 pet:pet_profiles(id, name, type, user_id)
 `)
 .eq("vet_id", vetId)
 .order("due_date", { ascending: true });

 if (error) throw error;
 setReminders(data || []);
 } catch (error) {
 console.error("Error loading reminders:", error);
 toast.error("Failed to load reminders");
 } finally {
 setIsLoading(false);
 }
 };

 const loadPatients = async () => {
 try {
 // Get patients that have interacted with this vet
 const { data: messagesData } = await supabase
 .from("vet_messages")
 .select("pet_id")
 .eq("vet_id", vetId)
 .not("pet_id","is", null);

 const petIds = [...new Set(messagesData?.map(m => m.pet_id).filter(Boolean))];

 if (petIds.length > 0) {
 const { data: petsData } = await supabase
 .from("pet_profiles")
 .select("id, name, type, user_id")
 .in("id", petIds);

 setPatients(petsData || []);
 }

 // Also get pets from consent requests
 const { data: consentData } = await supabase
 .from("pet_consent_requests")
 .select("pet_id")
 .eq("vet_id", vetId);

 const consentPetIds = [...new Set(consentData?.map(c => c.pet_id).filter(Boolean))];
 const allPetIds = [...new Set([...petIds, ...consentPetIds])];

 if (allPetIds.length > 0) {
 const { data: allPetsData } = await supabase
 .from("pet_profiles")
 .select("id, name, type, user_id")
 .in("id", allPetIds);

 setPatients(allPetsData || []);
 }
 } catch (error) {
 console.error("Error loading patients:", error);
 }
 };

 const resetForm = () => {
 setFormData({
 pet_id:"",
 reminder_type:"vaccination",
 title:"",
 description:"",
 due_date: format(new Date(),"yyyy-MM-dd"),
 recurrence_months:"0",
 sms_enabled: true,
 push_enabled: true,
 });
 setEditingReminder(null);
 };

 const handleEdit = (reminder: Reminder) => {
 setEditingReminder(reminder);
 setFormData({
 pet_id: reminder.pet_id,
 reminder_type: reminder.reminder_type,
 title: reminder.title,
 description: reminder.description ||"",
 due_date: reminder.due_date,
 recurrence_months: String(reminder.recurrence_months || 0),
 sms_enabled: reminder.sms_enabled,
 push_enabled: reminder.push_enabled,
 });
 setIsDialogOpen(true);
 };

 const handleSave = async () => {
 if (!formData.pet_id || !formData.title || !formData.due_date) {
 toast.error("Please fill in all required fields");
 return;
 }

 setIsSaving(true);
 try {
 const recurrenceMonths = parseInt(formData.recurrence_months) || null;
 const nextReminderAt = recurrenceMonths
 ? addMonths(parseISO(formData.due_date), recurrenceMonths).toISOString()
 : null;

 const reminderData = {
 pet_id: formData.pet_id,
 vet_id: vetId,
 reminder_type: formData.reminder_type,
 title: formData.title,
 description: formData.description || null,
 due_date: formData.due_date,
 recurrence_months: recurrenceMonths,
 sms_enabled: formData.sms_enabled,
 push_enabled: formData.push_enabled,
 next_reminder_at: nextReminderAt,
 };

 if (editingReminder) {
 const { error } = await supabase
 .from("compliance_reminders")
 .update(reminderData)
 .eq("id", editingReminder.id);

 if (error) throw error;
 toast.success("Reminder updated");
 } else {
 const { error } = await supabase
 .from("compliance_reminders")
 .insert(reminderData);

 if (error) throw error;
 toast.success("Reminder created");
 }

 setIsDialogOpen(false);
 resetForm();
 loadReminders();
 } catch (error: any) {
 console.error("Error saving reminder:", error);
 toast.error(error.message ||"Failed to save reminder");
 } finally {
 setIsSaving(false);
 }
 };

 const handleDelete = async (reminderId: string) => {
 if (!confirm("Are you sure you want to delete this reminder?")) return;

 try {
 const { error } = await supabase
 .from("compliance_reminders")
 .delete()
 .eq("id", reminderId);

 if (error) throw error;
 toast.success("Reminder deleted");
 loadReminders();
 } catch (error: any) {
 console.error("Error deleting reminder:", error);
 toast.error(error.message ||"Failed to delete reminder");
 }
 };

 const handleToggleActive = async (reminder: Reminder) => {
 try {
 const { error } = await supabase
 .from("compliance_reminders")
 .update({ is_active: !reminder.is_active })
 .eq("id", reminder.id);

 if (error) throw error;
 toast.success(reminder.is_active ?"Reminder paused" :"Reminder activated");
 loadReminders();
 } catch (error: any) {
 console.error("Error toggling reminder:", error);
 toast.error(error.message ||"Failed to update reminder");
 }
 };

 const handleSendNow = async (reminder: Reminder) => {
 setIsSending(reminder.id);
 try {
 const { error } = await supabase.functions.invoke("send-compliance-reminder", {
 body: { reminder_id: reminder.id },
 });

 if (error) throw error;
 toast.success("Reminder sent successfully");
 loadReminders();
 } catch (error: any) {
 console.error("Error sending reminder:", error);
 toast.error(error.message ||"Failed to send reminder");
 } finally {
 setIsSending(null);
 }
 };

 const getReminderTypeLabel = (type: string) => {
 return REMINDER_TYPES.find(t => t.value === type)?.label || type;
 };

 const getStatusBadge = (reminder: Reminder) => {
 const dueDate = parseISO(reminder.due_date);
 const today = new Date();
 
 if (!reminder.is_active) {
 return <Badge variant="secondary">Paused</Badge>;
 }
 if (dueDate < today) {
 return <Badge variant="destructive">Overdue</Badge>;
 }
 if (dueDate <= addMonths(today, 1)) {
 return <Badge className="bg-warning">Due Soon</Badge>;
 }
 return <Badge className="bg-success">Scheduled</Badge>;
 };

 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-6 h-6 animate-spin" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-xl font-semibold flex items-center gap-2">
 <span className="w-5 h-5" aria-hidden="true">🔔</span>
 Compliance Reminders
 </h2>
 <p className="text-sm text-muted-foreground">
 Set up automated reminders for vaccinations, exams, and preventive care
 </p>
 </div>
 <Dialog open={isDialogOpen} onOpenChange={(open) => {
 setIsDialogOpen(open);
 if (!open) resetForm();
 }}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="w-4 h-4 mr-2" />
 New Reminder
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>
 {editingReminder ?"Edit Reminder" :"Create Compliance Reminder"}
 </DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label>Patient *</Label>
 <Select value={formData.pet_id} onValueChange={(v) => setFormData({ ...formData, pet_id: v })}>
 <SelectTrigger>
 <SelectValue placeholder="Select a patient" />
 </SelectTrigger>
 <SelectContent>
 {patients.map((pet) => (
 <SelectItem key={pet.id} value={pet.id}>
 {pet.name} ({pet.type})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Reminder Type *</Label>
 <Select value={formData.reminder_type} onValueChange={(v) => setFormData({ ...formData, reminder_type: v })}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {REMINDER_TYPES.map((type) => (
 <SelectItem key={type.value} value={type.value}>
 {type.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Title *</Label>
 <Input
 value={formData.title}
 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
 placeholder="e.g., Rabies Vaccination Due"
 />
 </div>

 <div className="space-y-2">
 <Label>Description</Label>
 <Textarea
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 placeholder="Additional details for the reminder..."
 rows={2}
 />
 </div>

 <div className="space-y-2">
 <Label>Due Date *</Label>
 <Input
 type="date"
 value={formData.due_date}
 onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
 />
 </div>

 <div className="space-y-2">
 <Label>Recurrence</Label>
 <Select value={formData.recurrence_months} onValueChange={(v) => setFormData({ ...formData, recurrence_months: v })}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {RECURRENCE_OPTIONS.map((opt) => (
 <SelectItem key={opt.value} value={opt.value}>
 {opt.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-3 pt-2">
 <Label>Notification Channels</Label>
 <div className="flex items-center justify-between">
 <span className="text-sm">SMS Notifications</span>
 <Switch
 checked={formData.sms_enabled}
 onCheckedChange={(checked) => setFormData({ ...formData, sms_enabled: checked })}
 />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm">Push Notifications</span>
 <Switch
 checked={formData.push_enabled}
 onCheckedChange={(checked) => setFormData({ ...formData, push_enabled: checked })}
 />
 </div>
 </div>
 </div>
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
 Cancel
 </Button>
 <Button onClick={handleSave} disabled={isSaving}>
 {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 {editingReminder ?"Update" :"Create"} Reminder
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 {reminders.length === 0 ? (
 <Card className="p-8 text-center text-muted-foreground">
 <span className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true">🔔</span>
 <p>No compliance reminders set up yet.</p>
 <p className="text-sm mt-1">Create reminders for vaccinations, exams, and preventive care.</p>
 </Card>
 ) : (
 <div className="grid gap-4">
 {reminders.map((reminder) => (
 <Card key={reminder.id} className={`p-4 ${!reminder.is_active ?"opacity-60" :""}`}>
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h3 className="font-medium">{reminder.title}</h3>
 {getStatusBadge(reminder)}
 <Badge variant="outline">{getReminderTypeLabel(reminder.reminder_type)}</Badge>
 </div>
 <p className="text-sm text-muted-foreground">
 Patient: {reminder.pet?.name ||"Unknown"} • Due: {format(parseISO(reminder.due_date),"MMM d, yyyy")}
 </p>
 {reminder.description && (
 <p className="text-sm mt-1">{reminder.description}</p>
 )}
 <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
 {reminder.recurrence_months && (
 <span>Recurs every {reminder.recurrence_months} month(s)</span>
 )}
 {reminder.sms_enabled && <Badge variant="secondary" className="text-xs">SMS</Badge>}
 {reminder.push_enabled && <Badge variant="secondary" className="text-xs">Push</Badge>}
 {reminder.last_sent_at && (
 <span>Last sent: {format(parseISO(reminder.last_sent_at),"MMM d, yyyy")}</span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-1">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleSendNow(reminder)}
 disabled={isSending === reminder.id}
 title="Send Now"
 >
 {isSending === reminder.id ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Send className="w-4 h-4" />
 )}
 </Button>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleToggleActive(reminder)}
 title={reminder.is_active ?"Pause" :"Activate"}
 >
 <span className={`w-4 h-4 ${reminder.is_active ?"" :"text-muted-foreground"}`} aria-hidden="true">📅</span>
 </Button>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleEdit(reminder)}
 >
 <Edit className="w-4 h-4" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleDelete(reminder.id)}
 >
 <Trash2 className="w-4 h-4 text-destructive" />
 </Button>
 </div>
 </div>
 </Card>
 ))}
 </div>
 )}
 </div>
 );
};
