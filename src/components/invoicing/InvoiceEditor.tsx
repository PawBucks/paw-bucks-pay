import { useState, useEffect, useMemo } from"react";
import { toast } from"sonner";
import { useForm, useFieldArray } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { format, addDays, parseISO } from"date-fns";
import { ArrowLeft, Calendar, DollarSign, Eye, Paperclip, Percent, Plus, Save, Send, Trash2, User } from "lucide-react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Separator } from"@/components/ui/separator";
import { Switch } from"@/components/ui/switch";
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
import { Invoice, InvoiceItem, InvoiceClient, InvoiceSettings, CatalogItem, InvoiceRecipient } from"@/services/api/invoicing.service";
import { CatalogItemPicker } from"./CatalogItemPicker";
import { InvoiceAttachments } from"./InvoiceAttachments";
import { InvoiceRecipients } from"./InvoiceRecipients";
import { PricingCalculator } from"@/components/merchant/PricingCalculator";
import { cn } from"@/lib/utils";

import { Formatters } from "@/utils/formatters";

// Flatten react-hook-form errors into "field: message" strings the user can act on.
function collectErrorMessages(errors: any, prefix = ""): string[] {
	if (!errors || typeof errors !== "object") return [];
	const out: string[] = [];
	for (const [key, val] of Object.entries(errors as Record<string, any>)) {
		if (!val) continue;
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof val === "object" && "message" in val && val.message) {
			out.push(`${path}: ${val.message}`);
		} else if (Array.isArray(val)) {
			val.forEach((v, i) => out.push(...collectErrorMessages(v, `${path}[${i}]`)));
		} else if (typeof val === "object") {
			out.push(...collectErrorMessages(val, path));
		}
	}
	return out;
}

function showValidationErrors(errors: any) {
	console.error("[InvoiceEditor] Validation errors:", errors);
	const messages = collectErrorMessages(errors);
	if (messages.length === 0) {
		toast.error("Could not save: form validation failed but no field errors were reported. Check the browser console for details.");
		return;
	}
	const summary = messages.slice(0, 4).join("\n");
	const more = messages.length > 4 ? `\n…and ${messages.length - 4} more` : "";
	toast.error("Please fix the following before saving:", {
		description: `${summary}${more}`,
		duration: 8000,
	});
}

const invoiceSchema = z.object({
 client_id: z.string().optional(),
 client_name: z.string().min(1,"Client name is required"),
 client_email: z.string().email("Valid email is required"),
 client_phone: z.string().optional(),
 client_company: z.string().optional(),
 client_address: z.string().optional(),
 title: z.string().optional(),
 issue_date: z.date(),
 due_date: z.date(),
 payment_terms: z.number().min(0),
  discount_type: z.enum(["percentage","flat"]).nullish().transform((v) => v ?? undefined),
 discount_value: z.number().min(0).optional(),
 tax_rate: z.number().min(0).max(100),
 shipping_amount: z.number().min(0),
 notes: z.string().optional(),
 footer: z.string().optional(),
 terms_conditions: z.string().optional(),
 allow_partial_payments: z.boolean(),
 allow_tips: z.boolean(),
 accept_credit_card: z.boolean(),
 accept_bank_transfer: z.boolean(),
 accept_pawbucks: z.boolean().default(true),
 is_recurring: z.boolean(),
 recurring_interval: z.string().optional(),
 recurring_end_date: z.date().optional(),
 items: z.array(z.object({
 id: z.string().optional(),
 description: z.string().min(1,"Description is required"),
 quantity: z.number().min(0.001,"Quantity must be greater than 0"),
 unit_price: z.number().min(0,"Price must be 0 or greater"),
 unit_type: z.string(),
  discount_type: z.enum(["percentage","flat"]).nullish().transform((v) => v ?? undefined),
 discount_value: z.number().min(0).optional(),
 tax_rate: z.number().min(0).max(100),
 })).min(1,"At least one item is required"),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceEditorProps {
 invoice?: Invoice & { items?: InvoiceItem[]; recipients?: InvoiceRecipient[] };
 invoiceNumber: string;
 merchantId: string;
 clients: InvoiceClient[];
 catalogItems?: CatalogItem[];
 settings?: InvoiceSettings;
 onSave: (data: any, items: any[], recipients?: any[]) => Promise<string | null | void>;
 onSend: (data: any, items: any[], recipients?: any[]) => Promise<void>;
 onPreview: (data: any, items: any[]) => void;
 onBack: () => void;
 saving: boolean;
}

export function InvoiceEditor({
 invoice,
 invoiceNumber,
 merchantId,
 clients,
 catalogItems = [],
 settings,
 onSave,
 onSend,
 onPreview,
 onBack,
 saving,
}: InvoiceEditorProps) {
 const [selectedClient, setSelectedClient] = useState<InvoiceClient | null>(null);
 const [attachments, setAttachments] = useState<string[]>(
 invoice?.attachment_urls || []
 );
 const [recipients, setRecipients] = useState<InvoiceRecipient[]>(
 invoice?.recipients || []
 );

 const defaultValues: InvoiceFormData = {
 client_id: invoice?.client_id ||"",
 client_name: invoice?.client_name ||"",
 client_email: invoice?.client_email ||"",
 client_phone: invoice?.client_phone ||"",
 client_company: invoice?.client_company ||"",
 client_address: invoice?.client_address ||"",
 title: invoice?.title ||"",
  issue_date: invoice?.issue_date ? parseISO(invoice.issue_date) : new Date(),
  due_date: invoice?.due_date ? parseISO(invoice.due_date) : addDays(new Date(), settings?.default_payment_terms ?? 30),
  payment_terms: invoice?.payment_terms ?? settings?.default_payment_terms ?? 30,
 discount_type: (invoice?.discount_type as"percentage" |"flat") || undefined,
 discount_value: invoice?.discount_value || 0,
 tax_rate: invoice?.tax_rate ?? settings?.default_tax_rate ?? 0,
 shipping_amount: invoice?.shipping_amount || 0,
 notes: invoice?.notes || settings?.default_notes ||"",
 footer: invoice?.footer || settings?.default_footer ||"",
 terms_conditions: invoice?.terms_conditions ||"",
 allow_partial_payments: invoice?.allow_partial_payments ?? true,
 allow_tips: invoice?.allow_tips ?? false,
 accept_credit_card: invoice?.accept_credit_card ?? true,
 accept_bank_transfer: invoice?.accept_bank_transfer ?? false,
 accept_pawbucks: true,
 is_recurring: invoice?.is_recurring ?? false,
 recurring_interval: invoice?.recurring_interval ||"monthly",
 recurring_end_date: invoice?.recurring_end_date ? parseISO(invoice.recurring_end_date) : undefined,
 items: invoice?.items?.map(item => ({
 id: item.id,
 description: item.description,
 quantity: Number(item.quantity),
 unit_price: Number(item.unit_price),
 unit_type: item.unit_type ||"unit",
 discount_type: item.discount_type as"percentage" |"flat" | undefined,
 discount_value: item.discount_value || 0,
 tax_rate: item.tax_rate || 0,
 })) || [
 { description:"", quantity:"" as any, unit_price:"" as any, unit_type:"unit", tax_rate: 0 }
 ],
 };

 const form = useForm<InvoiceFormData>({
 resolver: zodResolver(invoiceSchema),
 defaultValues,
 });

 const { fields, append, remove } = useFieldArray({
 control: form.control,
 name:"items",
 });

 // Reset form when invoice prop changes (e.g. loading a different invoice for editing)
 useEffect(() => {
 const newDefaults: InvoiceFormData = {
 client_id: invoice?.client_id ||"",
 client_name: invoice?.client_name ||"",
 client_email: invoice?.client_email ||"",
 client_phone: invoice?.client_phone ||"",
 client_company: invoice?.client_company ||"",
 client_address: invoice?.client_address ||"",
 title: invoice?.title ||"",
 issue_date: invoice?.issue_date ? parseISO(invoice.issue_date) : new Date(),
 due_date: invoice?.due_date ? parseISO(invoice.due_date) : addDays(new Date(), settings?.default_payment_terms ?? 30),
 payment_terms: invoice?.payment_terms ?? settings?.default_payment_terms ?? 30,
 discount_type: (invoice?.discount_type as"percentage" |"flat") || undefined,
 discount_value: invoice?.discount_value || 0,
 tax_rate: invoice?.tax_rate ?? settings?.default_tax_rate ?? 0,
 shipping_amount: invoice?.shipping_amount || 0,
 notes: invoice?.notes || settings?.default_notes ||"",
 footer: invoice?.footer || settings?.default_footer ||"",
 terms_conditions: invoice?.terms_conditions ||"",
 allow_partial_payments: invoice?.allow_partial_payments ?? true,
 allow_tips: invoice?.allow_tips ?? false,
 accept_credit_card: invoice?.accept_credit_card ?? true,
 accept_bank_transfer: invoice?.accept_bank_transfer ?? false,
 accept_pawbucks: true,
 is_recurring: invoice?.is_recurring ?? false,
 recurring_interval: invoice?.recurring_interval ||"monthly",
 recurring_end_date: invoice?.recurring_end_date ? parseISO(invoice.recurring_end_date) : undefined,
 items: invoice?.items?.map(item => ({
 id: item.id,
 description: item.description,
 quantity: Number(item.quantity),
 unit_price: Number(item.unit_price),
 unit_type: item.unit_type ||"unit",
 discount_type: item.discount_type as"percentage" |"flat" | undefined,
 discount_value: item.discount_value || 0,
 tax_rate: item.tax_rate || 0,
 })) || [
 { description:"", quantity:"" as any, unit_price:"" as any, unit_type:"unit", tax_rate: 0 }
 ],
 };
 form.reset(newDefaults);
 setAttachments(invoice?.attachment_urls || []);
 setRecipients(invoice?.recipients || []);
  // Re-run when invoice identity changes OR when default settings load for a brand-new invoice
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id, invoice ? null : settings?.default_payment_terms, invoice ? null : settings?.default_tax_rate, invoice ? null : settings?.default_notes, invoice ? null : settings?.default_footer]);

 const watchDiscountType = form.watch("discount_type");
 const watchDiscountValue = form.watch("discount_value");
 const watchTaxRate = form.watch("tax_rate");
 const watchShipping = form.watch("shipping_amount");
 const watchIsRecurring = form.watch("is_recurring");

 // Watch all form values to trigger re-calculation
 const formValues = form.watch();

 // Calculate totals - using formValues.items for reactive updates
 const totals = useMemo(() => {
 const items = formValues.items || [];
 let subtotal = 0;
 let itemsTax = 0;

 items.forEach(item => {
 const quantity = Number(item.quantity) || 0;
 const unitPrice = Number(item.unit_price) || 0;
 const lineTotal = quantity * unitPrice;
 
 let lineDiscount = 0;
 if (item.discount_type ==="percentage") {
 lineDiscount = lineTotal * ((Number(item.discount_value) || 0) / 100);
 } else if (item.discount_type ==="flat") {
 lineDiscount = Number(item.discount_value) || 0;
 }
 const lineAfterDiscount = lineTotal - lineDiscount;
 const lineTax = lineAfterDiscount * ((Number(item.tax_rate) || 0) / 100);
 subtotal += lineAfterDiscount;
 itemsTax += lineTax;
 });

 // Invoice-level discount
 let invoiceDiscount = 0;
 const discountType = formValues.discount_type;
 const discountValue = Number(formValues.discount_value) || 0;
 if (discountType ==="percentage") {
 invoiceDiscount = subtotal * (discountValue / 100);
 } else if (discountType ==="flat") {
 invoiceDiscount = discountValue;
 }

 const afterDiscount = subtotal - invoiceDiscount;
 
 // Invoice-level tax
 const taxRate = Number(formValues.tax_rate) || 0;
 const invoiceTax = afterDiscount * (taxRate / 100);
 
 // Total tax is item-level + invoice-level
 const totalTax = itemsTax + invoiceTax;
 
 const shipping = Number(formValues.shipping_amount) || 0;
 const total = afterDiscount + totalTax + shipping;

 return { subtotal, discount: invoiceDiscount, tax: totalTax, shipping, total };
 }, [formValues]);

 // Handle client selection
 const handleClientSelect = (clientId: string) => {
 if (clientId ==="new") {
 // Reset fields for new client
 form.setValue("client_id","");
 form.setValue("client_name","");
 form.setValue("client_email","");
 form.setValue("client_phone","");
 form.setValue("client_company","");
 form.setValue("client_address","");
 setSelectedClient(null);
 } else {
 const client = clients.find(c => c.id === clientId);
 if (client) {
 form.setValue("client_id", client.id);
 form.setValue("client_name", client.name);
 form.setValue("client_email", client.email);
 form.setValue("client_phone", client.phone ||"");
 form.setValue("client_company", client.company_name ||"");
 const address = [
 client.address_line1,
 client.address_line2,
 [client.city, client.state, client.postal_code].filter(Boolean).join(""),
 client.country !=="US" ? client.country :""
 ].filter(Boolean).join("\n");
 form.setValue("client_address", address);
 setSelectedClient(client);
 }
 }
 };

 // Update due date when payment terms change
 const handlePaymentTermsChange = (terms: number) => {
 form.setValue("payment_terms", terms);
 const issueDate = form.getValues("issue_date");
 form.setValue("due_date", addDays(issueDate, terms));
 };

 // Update due date when issue date changes (respecting current payment terms)
 const handleIssueDateChange = (date: Date | undefined) => {
 if (!date) return;
 form.setValue("issue_date", date);
 const paymentTerms = form.getValues("payment_terms");
 form.setValue("due_date", addDays(date, paymentTerms));
 };

 // Handle catalog item selection
 const handleCatalogItemSelect = (catalogItem: CatalogItem) => {
 append({
 description: catalogItem.description 
 ? `${catalogItem.name}\n${catalogItem.description}` 
 : catalogItem.name,
 quantity: 1,
 unit_price: Number(catalogItem.unit_price),
 unit_type: catalogItem.unit_type ||"unit",
 tax_rate: Number(catalogItem.tax_rate) || 0,
 });
 };

 const handleSubmit = async (data: InvoiceFormData, sendImmediately: boolean = false) => {
 // Warn about blank line items
 const blankItems = data.items.filter(
 (item) => !item.description && Number(item.quantity) === 0 && Number(item.unit_price) === 0
 );
 if (blankItems.length > 0) {
 toast.warning(
 `${blankItems.length} line item${blankItems.length > 1 ?"s" :""} ${blankItems.length > 1 ?"are" :"is"} blank and will be hidden from the customer. Please fill in Description, Qty, and Rate.`
 );
 }

 const invoiceData = {
 ...data,
 issue_date: format(data.issue_date,"yyyy-MM-dd"),
 due_date: format(data.due_date,"yyyy-MM-dd"),
 recurring_end_date: data.recurring_end_date ? format(data.recurring_end_date,"yyyy-MM-dd") : null,
 subtotal: totals.subtotal,
 discount_amount: totals.discount,
 tax_amount: totals.tax,
 total: totals.total,
 attachment_urls: attachments.length > 0 ? attachments : null,
 };

 const itemsData = data.items.map((item, index) => ({
 ...item,
 sort_order: index,
 discount_amount: item.discount_type ==="percentage" 
 ? (item.quantity * item.unit_price) * ((item.discount_value || 0) / 100)
 : (item.discount_value || 0),
 tax_amount: ((item.quantity * item.unit_price) - (item.discount_type ==="percentage" 
 ? (item.quantity * item.unit_price) * ((item.discount_value || 0) / 100)
 : (item.discount_value || 0))) * ((item.tax_rate || 0) / 100),
 }));

 if (sendImmediately) {
 await onSend(invoiceData, itemsData, recipients);
 } else {
 await onSave(invoiceData, itemsData, recipients);
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Button variant="ghost" size="icon" onClick={onBack}>
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <div>
 <h1 className="text-2xl font-bold">
 {invoice ? `Edit Invoice ${invoice.invoice_number}` :"New Invoice"}
 </h1>
 {!invoice && (
 <p className="text-muted-foreground">Invoice # {invoiceNumber}</p>
 )}
 </div>
 </div>
 <div className="flex gap-2">
 <Button 
 variant="outline" 
 onClick={() => onPreview(form.getValues(), form.getValues("items"))}
 >
 <Eye className="h-4 w-4 mr-2" />
 Preview
 </Button>
 <Button
 variant="outline"
					onClick={form.handleSubmit(
						(data) => handleSubmit(data, false),
						(errors) => showValidationErrors(errors),
					)}
 disabled={saving}
 >
 <Save className="h-4 w-4 mr-2" />
 Save Draft
 </Button>
 <Button
					onClick={form.handleSubmit(
						(data) => handleSubmit(data, true),
						(errors) => showValidationErrors(errors),
					)}
 disabled={saving}
 >
 <Send className="h-4 w-4 mr-2" />
 Save & Send
 </Button>
 </div>
 </div>

 <Form {...form}>
 <form className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Main Content */}
 <div className="lg:col-span-2 space-y-6">
 {/* Client Selection */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <User className="h-5 w-5" />
 Client Information
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <Label>Select Client</Label>
 <Select 
 value={form.watch("client_id") ||"new"} 
 onValueChange={handleClientSelect}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select a client or enter new" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="new">+ New Client</SelectItem>
 {clients.map(client => (
 <SelectItem key={client.id} value={client.id}>
 {client.name} {client.company_name && `(${client.company_name})`}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="client_name"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Name *</FormLabel>
 <FormControl>
 <Input placeholder="Client name" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="client_email"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Email *</FormLabel>
 <FormControl>
 <Input type="email" placeholder="client@example.com" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="client_phone"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Phone</FormLabel>
 <FormControl>
 <Input placeholder="Phone number" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="client_company"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Company</FormLabel>
 <FormControl>
 <Input placeholder="Company name" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 <FormField
 control={form.control}
 name="client_address"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Address</FormLabel>
 <FormControl>
 <Textarea 
 placeholder="Client address"
 className="min-h-[80px]"
 {...field} 
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>

 {/* Additional Recipients */}
 <Card>
 <CardContent className="pt-6">
 <InvoiceRecipients
 recipients={recipients}
 clients={clients}
 onChange={setRecipients}
 />
 </CardContent>
 </Card>

 {/* Line Items */}
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <CardTitle>Line Items</CardTitle>
 {catalogItems.length > 0 && (
 <CatalogItemPicker 
 items={catalogItems} 
 onSelect={handleCatalogItemSelect} 
 />
 )}
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 {fields.map((field, index) => (
 <div key={field.id} className="flex gap-3 items-start p-4 border rounded-lg bg-muted/30">
 <div className="flex-1 grid grid-cols-12 gap-3">
 <div className="col-span-12 md:col-span-5">
 <FormField
 control={form.control}
 name={`items.${index}.description`}
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-xs">Description</FormLabel>
 <FormControl>
 <Textarea 
 placeholder="Item description" 
 className="min-h-[60px]"
 {...field} 
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 <div className="col-span-4 md:col-span-2">
 <FormField
 control={form.control}
 name={`items.${index}.quantity`}
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-xs">Qty</FormLabel>
 <FormControl>
 <Input 
 type="number" 
 step="0.01"
 min="0"
 placeholder="0"
 {...field}
 value={(field.value as any) ==="" ?"" : field.value}
 onChange={(e) => {
 const val = e.target.value;
 field.onChange(val ==="" ?"" : parseFloat(val));
 }}
 onBlur={(e) => {
 const val = parseFloat(e.target.value);
 if (isNaN(val) || e.target.value ==="") field.onChange(0);
 field.onBlur();
 }}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 <div className="col-span-4 md:col-span-2">
 <FormField
 control={form.control}
 name={`items.${index}.unit_type`}
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-xs">Unit</FormLabel>
 <Select value={field.value} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="unit">Unit</SelectItem>
 <SelectItem value="hour">Hour</SelectItem>
 <SelectItem value="day">Day</SelectItem>
 <SelectItem value="week">Week</SelectItem>
 <SelectItem value="month">Month</SelectItem>
 <SelectItem value="project">Project</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 <div className="col-span-4 md:col-span-2">
 <FormField
 control={form.control}
 name={`items.${index}.unit_price`}
 render={({ field }) => (
 <FormItem>
 <FormLabel className="text-xs">Price</FormLabel>
 <FormControl>
 <div className="relative">
 <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input 
 type="number"
 step="0.01"
 min="0"
 className="pl-7"
 placeholder="0.00"
 {...field}
 value={(field.value as any) ==="" ?"" : field.value}
 onChange={(e) => {
 const val = e.target.value;
 field.onChange(val ==="" ?"" : parseFloat(val));
 }}
 onBlur={(e) => {
 const val = parseFloat(e.target.value);
 if (isNaN(val) || e.target.value ==="") field.onChange(0);
 field.onBlur();
 }}
 />
 </div>
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 <div className="col-span-12 md:col-span-1 flex items-end justify-end">
 <p className="font-semibold pb-2">
 {Formatters.currency(((formValues.items?.[index]?.quantity || 0) * (formValues.items?.[index]?.unit_price || 0)))}
 </p>
 </div>
 </div>
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => remove(index)}
 disabled={fields.length === 1}
 className="mt-6"
 >
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </div>
 ))}

 <Button
 type="button"
 variant="outline"
 onClick={() => append({ 
 description:"", 
 quantity:"" as any, 
 unit_price:"" as any, 
 unit_type:"unit",
 tax_rate: 0 
 })}
 className="w-full"
 >
 <Plus className="h-4 w-4 mr-2" />
 Add Line Item
 </Button>

 <Separator className="my-4" />

 <PricingCalculator compact />
 </CardContent>
 </Card>

 {/* Notes & Terms */}
 <Card>
 <CardHeader>
 <CardTitle>Notes & Terms</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <FormField
 control={form.control}
 name="notes"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Notes (visible to client)</FormLabel>
 <FormControl>
 <Textarea 
 placeholder="Thank you for your business!"
 className="min-h-[80px]"
 {...field} 
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="terms_conditions"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Terms & Conditions</FormLabel>
 <FormControl>
 <Textarea 
 placeholder="Payment terms and conditions..."
 className="min-h-[80px]"
 {...field} 
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="footer"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Footer</FormLabel>
 <FormControl>
 <Input placeholder="Footer text" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>

 {/* Attachments */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Paperclip className="h-5 w-5" />
 Attachments
 </CardTitle>
 </CardHeader>
 <CardContent>
 <InvoiceAttachments
 merchantId={merchantId}
 invoiceId={invoice?.id}
 attachments={attachments}
 onChange={setAttachments}
 />
 </CardContent>
 </Card>
 </div>

 {/* Sidebar */}
 <div className="space-y-6">
 {/* Invoice Details */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Calendar className="h-5 w-5" />
 Invoice Details
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <FormField
 control={form.control}
 name="title"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Invoice Title</FormLabel>
 <FormControl>
 <Input placeholder="e.g., Pet Grooming Services" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="issue_date"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Issue Date</FormLabel>
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
 onSelect={handleIssueDateChange}
 initialFocus
 className="pointer-events-auto"
 />
 </PopoverContent>
 </Popover>
 <FormMessage />
 </FormItem>
 )}
 />

 <div>
 <Label>Payment Terms</Label>
 <Select
 value={form.watch("payment_terms").toString()}
 onValueChange={(v) => handlePaymentTermsChange(parseInt(v))}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
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
 </div>

 <FormField
 control={form.control}
 name="due_date"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Due Date</FormLabel>
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
 className="pointer-events-auto"
 />
 </PopoverContent>
 </Popover>
 <FormMessage />
 </FormItem>
 )}
 />
 </CardContent>
 </Card>

 {/* Discount & Tax */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Percent className="h-5 w-5" />
 Discount & Tax
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-2 gap-3">
 <FormField
 control={form.control}
 name="discount_type"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Discount</FormLabel>
 <Select 
 value={field.value ||"none"} 
 onValueChange={(val) => field.onChange(val ==="none" ? undefined : val)}
 >
 <FormControl>
 <SelectTrigger>
 <SelectValue placeholder="None" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="none">None</SelectItem>
 <SelectItem value="percentage">%</SelectItem>
 <SelectItem value="flat">$</SelectItem>
 </SelectContent>
 </Select>
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="discount_value"
 render={({ field }) => (
 <FormItem>
 <FormLabel>&nbsp;</FormLabel>
 <FormControl>
 <Input
 type="number"
 step="0.01"
 min="0"
 disabled={!watchDiscountType}
 {...field}
 onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
 />
 </FormControl>
 </FormItem>
 )}
 />
 </div>

 <FormField
 control={form.control}
 name="tax_rate"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Tax Rate (%)</FormLabel>
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
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="shipping_amount"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Shipping / Handling</FormLabel>
 <FormControl>
 <div className="relative">
 <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 type="number"
 step="0.01"
 min="0"
 className="pl-7"
 {...field}
 onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
 />
 </div>
 </FormControl>
 </FormItem>
 )}
 />
 </CardContent>
 </Card>

 {/* Totals */}
 <Card>
 <CardHeader>
 <CardTitle>Summary</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Subtotal</span>
 <span>{Formatters.currency(totals.subtotal)}</span>
 </div>
 {totals.discount > 0 && (
 <div className="flex justify-between text-sm text-success">
 <span>Discount</span>
 <span>-{Formatters.currency(totals.discount)}</span>
 </div>
 )}
 {totals.tax > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Tax</span>
 <span>{Formatters.currency(totals.tax)}</span>
 </div>
 )}
 {totals.shipping > 0 && (
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Shipping</span>
 <span>{Formatters.currency(totals.shipping)}</span>
 </div>
 )}
 <Separator />
 <div className="flex justify-between font-bold text-lg">
 <span>Total</span>
 <span>{Formatters.currency(totals.total)}</span>
 </div>
 </CardContent>
 </Card>

 {/* Payment Options */}
 <Card>
 <CardHeader>
 <CardTitle>Payment Options</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <FormField
 control={form.control}
 name="accept_credit_card"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between">
 <FormLabel className="text-sm">Accept Credit Card</FormLabel>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="accept_bank_transfer"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between">
 <FormLabel className="text-sm">Accept Bank Transfer</FormLabel>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />
  {/* PawBucks is always accepted on every invoice (platform requirement) */}
 <FormField
 control={form.control}
 name="allow_partial_payments"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between">
 <FormLabel className="text-sm">Allow Partial Payments</FormLabel>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="allow_tips"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between">
 <FormLabel className="text-sm">Allow Tips</FormLabel>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />
 </CardContent>
 </Card>

 {/* Recurring */}
 <Card>
 <CardHeader>
 <CardTitle>Recurring Invoice</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <FormField
 control={form.control}
 name="is_recurring"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between">
 <FormLabel className="text-sm">Make Recurring</FormLabel>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} />
 </FormControl>
 </FormItem>
 )}
 />
 {watchIsRecurring && (
 <>
 <FormField
 control={form.control}
 name="recurring_interval"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Repeat</FormLabel>
 <Select value={field.value} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="weekly">Weekly</SelectItem>
 <SelectItem value="biweekly">Bi-weekly</SelectItem>
 <SelectItem value="monthly">Monthly</SelectItem>
 <SelectItem value="quarterly">Quarterly</SelectItem>
 <SelectItem value="yearly">Yearly</SelectItem>
 </SelectContent>
 </Select>
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="recurring_end_date"
 render={({ field }) => (
 <FormItem>
 <FormLabel>End Date (optional)</FormLabel>
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
 {field.value ? format(field.value,"PPP") :"No end date"}
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
 </FormItem>
 )}
 />
 </>
 )}
 </CardContent>
 </Card>
 </div>
 </form>
 </Form>
 </div>
 );
}
