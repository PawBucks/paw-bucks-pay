import { useState, useEffect } from"react";
import { useForm } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { Bell, CreditCard, DollarSign, FileText, Hash, Loader2, Palette, Save, Send, Settings } from "lucide-react";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Switch } from"@/components/ui/switch";
import { Separator } from"@/components/ui/separator";
import {
 Form,
 FormControl,
 FormField,
 FormItem,
 FormLabel,
 FormMessage,
 FormDescription,
} from"@/components/ui/form";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { InvoiceSettings as InvoiceSettingsType } from"@/services/api/invoicing.service";
import { toast } from"sonner";

const settingsSchema = z.object({
 invoice_prefix: z.string().min(1,"Prefix is required"),
 next_invoice_number: z.number().min(1),
 default_payment_terms: z.number().min(0),
 default_tax_rate: z.number().min(0).max(100),
 default_notes: z.string().optional(),
 default_footer: z.string().optional(),
 late_fee_enabled: z.boolean(),
 late_fee_type: z.enum(["percentage","flat"]),
 late_fee_amount: z.number().min(0),
 late_fee_grace_days: z.number().min(0),
 reminder_enabled: z.boolean(),
 accent_color: z.string(),
 bank_name: z.string().optional(),
 bank_account_name: z.string().optional(),
 bank_routing_number: z.string().optional(),
 bank_account_number_last4: z.string().optional(),
 paypal_email: z.string().email().optional().or(z.literal("")),
 venmo_handle: z.string().optional(),
 default_currency: z.string(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface InvoiceSettingsProps {
 settings: InvoiceSettingsType | null;
 merchantId: string;
 onSave: (data: Partial<InvoiceSettingsType>) => Promise<void>;
 loading: boolean;
}

export function InvoiceSettingsComponent({
 settings,
 merchantId,
 onSave,
 loading,
}: InvoiceSettingsProps) {
 const [saving, setSaving] = useState(false);
 const [sendingReminders, setSendingReminders] = useState(false);

 const handleSendReminders = async () => {
 setSendingReminders(true);
 try {
 const { data, error } = await supabase.functions.invoke("send-invoice-reminders", {
 body: { merchantId },
 });

 if (error) throw error;

 const { remindersSent = 0, overdueUpdated = 0 } = data || {};
 
 if (remindersSent > 0) {
 toast.success(`Sent ${remindersSent} reminder${remindersSent > 1 ?"s" :""} successfully`);
 } else {
 toast.info("No reminders needed - all invoices are either paid or recently reminded");
 }
 
 if (overdueUpdated > 0) {
 toast.info(`${overdueUpdated} invoice${overdueUpdated > 1 ?"s" :""} marked as overdue`);
 }
 } catch (error: any) {
 console.error("Error sending reminders:", error);
 toast.error(error.message ||"Failed to send reminders");
 } finally {
 setSendingReminders(false);
 }
 };

  const getFormValues = (s: InvoiceSettingsType | null): SettingsFormData => ({
  invoice_prefix: s?.invoice_prefix ||"INV-",
  next_invoice_number: s?.next_invoice_number || 1001,
  default_payment_terms: s?.default_payment_terms ?? 30,
  default_tax_rate: s?.default_tax_rate ?? 0,
 default_notes: s?.default_notes ||"",
 default_footer: s?.default_footer ||"",
 late_fee_enabled: s?.late_fee_enabled || false,
 late_fee_type: (s?.late_fee_type as"percentage" |"flat") ||"percentage",
 late_fee_amount: s?.late_fee_amount || 0,
 late_fee_grace_days: s?.late_fee_grace_days || 0,
 reminder_enabled: s?.reminder_enabled ?? true,
 accent_color: s?.accent_color ||"#3b82f6",
 bank_name: s?.bank_name ||"",
 bank_account_name: s?.bank_account_name ||"",
 bank_routing_number: s?.bank_routing_number ||"",
 bank_account_number_last4: s?.bank_account_number_last4 ||"",
 paypal_email: s?.paypal_email ||"",
 venmo_handle: s?.venmo_handle ||"",
 default_currency: s?.default_currency ||"USD",
 });

 const form = useForm<SettingsFormData>({
 resolver: zodResolver(settingsSchema),
 defaultValues: getFormValues(settings),
 });

 // Reset form when settings are loaded/updated from the server
 useEffect(() => {
 if (settings) {
 form.reset(getFormValues(settings));
 }
 }, [settings]);

 const watchLateFeeEnabled = form.watch("late_fee_enabled");
 const watchLateFeeType = form.watch("late_fee_type");

 const handleSubmit = async (data: SettingsFormData) => {
 setSaving(true);
 try {
 await onSave(data);
 toast.success("Settings saved successfully");
 } catch (error) {
 toast.error("Failed to save settings");
 } finally {
 setSaving(false);
 }
 };

 return (
 <Form {...form}>
 <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
 {/* Invoice Numbering */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Hash className="h-5 w-5" />
 Invoice Numbering
 </CardTitle>
 <CardDescription>
 Configure how your invoices are numbered
 </CardDescription>
 </CardHeader>
 <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="invoice_prefix"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Invoice Prefix</FormLabel>
 <FormControl>
 <Input placeholder="INV-" {...field} />
 </FormControl>
 <FormDescription>
 e.g., INV-, INVOICE-, or your initials
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="next_invoice_number"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Next Invoice Number</FormLabel>
 <FormControl>
 <Input
 type="number"
 min="1"
 {...field}
 onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
 />
 </FormControl>
 <FormDescription>
 The next invoice will be {form.watch("invoice_prefix")}{String(form.watch("next_invoice_number")).padStart(5,'0')}
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>

 {/* Default Settings */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <FileText className="h-5 w-5" />
 Default Invoice Settings
 </CardTitle>
 <CardDescription>
 These defaults will be applied to new invoices
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <FormField
 control={form.control}
 name="default_payment_terms"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Payment Terms (Days)</FormLabel>
 <Select
 value={field.value.toString()}
 onValueChange={(v) => field.onChange(parseInt(v))}
 >
 <FormControl>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="0">Due on Receipt</SelectItem>
 <SelectItem value="7">Net 7</SelectItem>
 <SelectItem value="14">Net 14</SelectItem>
 <SelectItem value="15">Net 15</SelectItem>
 <SelectItem value="30">Net 30</SelectItem>
 <SelectItem value="45">Net 45</SelectItem>
 <SelectItem value="60">Net 60</SelectItem>
 <SelectItem value="90">Net 90</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="default_tax_rate"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Default Tax Rate (%)</FormLabel>
 <FormControl>
 <Input
 type="number"
 step="0.001"
 min="0"
 max="100"
 {...field}
 onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="default_currency"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Currency</FormLabel>
 <Select value={field.value} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="USD">USD ($)</SelectItem>
 <SelectItem value="EUR">EUR (€)</SelectItem>
 <SelectItem value="GBP">GBP (£)</SelectItem>
 <SelectItem value="CAD">CAD ($)</SelectItem>
 <SelectItem value="AUD">AUD ($)</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 <FormField
 control={form.control}
 name="default_notes"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Default Notes</FormLabel>
 <FormControl>
 <Textarea
 placeholder="Thank you for your business!"
 className="min-h-[80px]"
 {...field}
 />
 </FormControl>
 <FormDescription>
 This will appear on all new invoices
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="default_footer"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Default Footer</FormLabel>
 <FormControl>
 <Input placeholder="Footer text" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>

 {/* Late Fees */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <DollarSign className="h-5 w-5" />
 Late Fees
 </CardTitle>
 <CardDescription>
 Automatically apply late fees to overdue invoices
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <FormField
 control={form.control}
 name="late_fee_enabled"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between">
 <div>
 <FormLabel>Enable Late Fees</FormLabel>
 <FormDescription>
 Apply fees when invoices become overdue
 </FormDescription>
 </div>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />

 {watchLateFeeEnabled && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
 <FormField
 control={form.control}
 name="late_fee_type"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Fee Type</FormLabel>
 <Select value={field.value} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="percentage">Percentage (%)</SelectItem>
 <SelectItem value="flat">Flat Amount ($)</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="late_fee_amount"
 render={({ field }) => (
 <FormItem>
 <FormLabel>
 Fee Amount ({watchLateFeeType ==="percentage" ?"%" :"$"})
 </FormLabel>
 <FormControl>
 <Input
 type="number"
 step="0.01"
 min="0"
 {...field}
 onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="late_fee_grace_days"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Grace Period (Days)</FormLabel>
 <FormControl>
 <Input
 type="number"
 min="0"
 {...field}
 onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
 />
 </FormControl>
 <FormDescription>
 Days after due date before fee applies
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 )}
 </CardContent>
 </Card>

 {/* Reminders */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Bell className="h-5 w-5" />
 Payment Reminders
 </CardTitle>
 <CardDescription>
 Automatically send payment reminders to clients
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <FormField
 control={form.control}
 name="reminder_enabled"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between">
 <div>
 <FormLabel>Enable Reminders</FormLabel>
 <FormDescription>
 Send automatic reminders before and after due date
 </FormDescription>
 </div>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />
 
 {form.watch("reminder_enabled") && (
 <div className="bg-muted rounded-lg p-4 space-y-3">
 <div>
 <p className="text-sm font-medium">Before Due Date</p>
 <p className="text-sm text-muted-foreground">
 Reminders sent 7, 3, and 1 day(s) before the invoice is due
 </p>
 </div>
 <Separator />
 <div>
 <p className="text-sm font-medium">After Due Date (Overdue)</p>
 <p className="text-sm text-muted-foreground">
 Reminders sent on the due date, then 1, 7, 14, and 30 day(s) after
 </p>
 </div>
 <Separator />
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium">Manual Reminders</p>
 <p className="text-sm text-muted-foreground">
 Send reminders now for all unpaid invoices that are due or overdue
 </p>
 </div>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={handleSendReminders}
 disabled={sendingReminders}
 >
 {sendingReminders ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Sending...
 </>
 ) : (
 <>
 <Send className="h-4 w-4 mr-2" />
 Send Reminders Now
 </>
 )}
 </Button>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Branding */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Palette className="h-5 w-5" />
 Branding
 </CardTitle>
 <CardDescription>
 Customize the look of your invoices
 </CardDescription>
 </CardHeader>
 <CardContent>
 <FormField
 control={form.control}
 name="accent_color"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Accent Color</FormLabel>
 <div className="flex gap-3 items-center">
 <FormControl>
 <Input
 type="color"
 className="w-16 h-10 p-1 cursor-pointer"
 {...field}
 />
 </FormControl>
 <Input
 value={field.value}
 onChange={field.onChange}
 className="w-28"
 placeholder="#3b82f6"
 />
 </div>
 <FormDescription>
 This color will be used for headings and buttons
 </FormDescription>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>

 {/* Payment Information */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <CreditCard className="h-5 w-5" />
 Payment Information
 </CardTitle>
 <CardDescription>
 Bank details shown on invoices for bank transfers
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="bank_name"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Bank Name</FormLabel>
 <FormControl>
 <Input placeholder="e.g., Chase Bank" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="bank_account_name"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Account Name</FormLabel>
 <FormControl>
 <Input placeholder="Account holder name" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="bank_routing_number"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Routing Number</FormLabel>
 <FormControl>
 <Input placeholder="Routing number" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="bank_account_number_last4"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Account Number (Last 4)</FormLabel>
 <FormControl>
 <Input placeholder="Last 4 digits" maxLength={4} {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 <Separator />
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="paypal_email"
 render={({ field }) => (
 <FormItem>
 <FormLabel>PayPal Email</FormLabel>
 <FormControl>
 <Input type="email" placeholder="paypal@example.com" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="venmo_handle"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Venmo Handle</FormLabel>
 <FormControl>
 <Input placeholder="@username" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 </CardContent>
 </Card>

 {/* Save Button */}
 <div className="flex justify-end">
 <Button type="submit" disabled={saving || loading}>
 <Save className="h-4 w-4 mr-2" />
 {saving ?"Saving..." :"Save Settings"}
 </Button>
 </div>
 </form>
 </Form>
 );
}
