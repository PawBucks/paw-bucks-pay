import { useState } from"react";
import { useForm } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { format } from"date-fns";
import { Calendar, DollarSign } from"lucide-react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from"@/components/ui/dialog";
import {
 Form,
 FormControl,
 FormField,
 FormItem,
 FormLabel,
 FormMessage,
} from"@/components/ui/form";
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
import { Calendar as CalendarComponent } from"@/components/ui/calendar";
import { Invoice, InvoicePayment, invoicingService } from"@/services/api/invoicing.service";
import { cn } from"@/lib/utils";
import { toast } from"sonner";
import { Checkbox } from"@/components/ui/checkbox";

const paymentSchema = z.object({
 amount: z.number().min(0.01,"Amount must be greater than 0"),
 payment_method: z.string().min(1,"Payment method is required"),
 payment_date: z.date(),
 reference_number: z.string().optional(),
 notes: z.string().optional(),
 send_receipt: z.boolean().default(true),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface RecordPaymentDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 invoice: Invoice;
 onRecordPayment: (payment: Partial<InvoicePayment>) => Promise<void>;
}

export function RecordPaymentDialog({
 open,
 onOpenChange,
 invoice,
 onRecordPayment,
}: RecordPaymentDialogProps) {
 const [saving, setSaving] = useState(false);

 const form = useForm<PaymentFormData>({
 resolver: zodResolver(paymentSchema),
 defaultValues: {
 amount: Number(invoice.amount_due),
 payment_method:"credit_card",
 payment_date: new Date(),
 reference_number:"",
 notes:"",
 send_receipt: true,
 },
 });

 const handleSubmit = async (data: PaymentFormData) => {
 if (data.amount > Number(invoice.amount_due)) {
 toast.error("Payment amount cannot exceed amount due");
 return;
 }

 setSaving(true);
 try {
 await onRecordPayment({
 invoice_id: invoice.id,
 amount: data.amount,
 payment_method: data.payment_method,
 payment_date: data.payment_date.toISOString(),
 reference_number: data.reference_number || undefined,
 notes: data.notes || undefined,
 status:"completed",
 });
 
 // Send receipt email if requested
 if (data.send_receipt) {
 try {
 const { error } = await invoicingService.sendInvoiceReceipt(invoice.id, false);
 if (error) {
 console.error("Failed to send receipt email:", error);
 toast.warning("Payment recorded, but receipt email failed to send");
 } else {
 toast.success("Payment recorded and receipt sent!");
 }
 } catch (receiptError) {
 console.error("Receipt email error:", receiptError);
 toast.success("Payment recorded successfully");
 }
 } else {
 toast.success("Payment recorded successfully");
 }
 
 onOpenChange(false);
 } catch (error) {
 toast.error("Failed to record payment");
 } finally {
 setSaving(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Record Payment</DialogTitle>
 </DialogHeader>

 <div className="bg-muted rounded-lg p-4 mb-4">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Invoice</span>
 <span className="font-medium">{invoice.invoice_number}</span>
 </div>
 <div className="flex justify-between text-sm mt-1">
 <span className="text-muted-foreground">Client</span>
 <span>{invoice.client_name}</span>
 </div>
 <div className="flex justify-between text-sm mt-1">
 <span className="text-muted-foreground">Amount Due</span>
 <span className="font-bold text-primary">${Number(invoice.amount_due).toFixed(2)}</span>
 </div>
 </div>

 <Form {...form}>
 <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
 <FormField
 control={form.control}
 name="amount"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Payment Amount</FormLabel>
 <FormControl>
 <div className="relative">
 <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 type="number"
 step="0.01"
 min="0.01"
 max={Number(invoice.amount_due)}
 className="pl-8"
 {...field}
 onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
 />
 </div>
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="payment_method"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Payment Method</FormLabel>
 <Select value={field.value} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger>
 <SelectValue placeholder="Select method" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="credit_card">Credit Card</SelectItem>
 <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
 <SelectItem value="cash">Cash</SelectItem>
 <SelectItem value="check">Check</SelectItem>
 <SelectItem value="pawbucks">PawBucks</SelectItem>
 <SelectItem value="paypal">PayPal</SelectItem>
 <SelectItem value="venmo">Venmo</SelectItem>
 <SelectItem value="other">Other</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="payment_date"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Payment Date</FormLabel>
 <Popover>
 <PopoverTrigger asChild>
 <FormControl>
 <Button
 variant="outline"
 className={cn(
"w-full justify-start text-left font-normal",
 !field.value &&"text-muted-foreground"
 )}
 >
 <Calendar className="mr-2 h-4 w-4" />
 {field.value ? format(field.value,"PPP") :"Pick a date"}
 </Button>
 </FormControl>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <CalendarComponent
 mode="single"
 selected={field.value}
 onSelect={field.onChange}
 initialFocus
 />
 </PopoverContent>
 </Popover>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="reference_number"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Reference / Transaction ID</FormLabel>
 <FormControl>
 <Input placeholder="Optional reference number" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="notes"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Notes</FormLabel>
 <FormControl>
 <Textarea
 placeholder="Optional notes about this payment"
 className="min-h-[60px]"
 {...field}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="send_receipt"
 render={({ field }) => (
 <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted">
 <FormControl>
 <Checkbox
 checked={field.value}
 onCheckedChange={field.onChange}
 />
 </FormControl>
 <div className="space-y-1 leading-none">
 <FormLabel className="cursor-pointer">
 Send receipt email to client
 </FormLabel>
 <p className="text-sm text-muted-foreground">
 {invoice.client_email}
 </p>
 </div>
 </FormItem>
 )}
 />

 <DialogFooter>
 <Button
 type="button"
 variant="outline"
 onClick={() => onOpenChange(false)}
 >
 Cancel
 </Button>
 <Button type="submit" disabled={saving}>
 {saving ?"Recording..." :"Record Payment"}
 </Button>
 </DialogFooter>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 );
}
