import { useState } from"react";
import { useForm, useFieldArray } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { Copy, Edit, FileText, LayoutTemplate, MoreHorizontal, Package, Plus, Search, Trash2 } from "lucide-react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Card, CardContent } from"@/components/ui/card";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from"@/components/ui/dialog";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from"@/components/ui/dropdown-menu";
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
import { Textarea } from"@/components/ui/textarea";
import { Switch } from"@/components/ui/switch";
import { Skeleton } from"@/components/ui/skeleton";
import { Badge } from"@/components/ui/badge";
import { Separator } from"@/components/ui/separator";
import { InvoiceTemplate, CatalogItem } from"@/services/api/invoicing.service";
import { toast } from"sonner";
import { CatalogItemPicker } from"./CatalogItemPicker";

const templateItemSchema = z.object({
 description: z.string().min(1,"Description is required"),
 quantity: z.number().min(0.01),
 unit_price: z.number().min(0),
 unit_type: z.string(),
 tax_rate: z.number().min(0).max(100),
});

const templateSchema = z.object({
 name: z.string().min(1,"Template name is required"),
 description: z.string().optional(),
 title: z.string().optional(),
 notes: z.string().optional(),
 footer: z.string().optional(),
 terms_conditions: z.string().optional(),
 payment_terms: z.number().min(0),
 tax_rate: z.number().min(0).max(100),
 discount_type: z.string().optional(),
 discount_value: z.number().optional(),
 allow_partial_payments: z.boolean(),
 is_default: z.boolean(),
 default_items: z.array(templateItemSchema),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateManagerProps {
 templates: InvoiceTemplate[];
 catalogItems: CatalogItem[];
 loading: boolean;
 onCreateTemplate: (data: Partial<InvoiceTemplate>) => Promise<void>;
 onUpdateTemplate: (templateId: string, data: Partial<InvoiceTemplate>) => Promise<void>;
 onDeleteTemplate: (templateId: string) => Promise<void>;
 onSetDefault: (templateId: string) => Promise<void>;
 onUseTemplate: (template: InvoiceTemplate) => void;
 onRefresh: () => void;
}

export function TemplateManager({
 templates,
 catalogItems,
 loading,
 onCreateTemplate,
 onUpdateTemplate,
 onDeleteTemplate,
 onSetDefault,
 onUseTemplate,
 onRefresh,
}: TemplateManagerProps) {
 const [searchTerm, setSearchTerm] = useState("");
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
 const [saving, setSaving] = useState(false);

 const form = useForm<TemplateFormData>({
 resolver: zodResolver(templateSchema),
 defaultValues: {
 name:"",
 description:"",
 title:"",
 notes:"",
 footer:"",
 terms_conditions:"",
 payment_terms: 30,
 tax_rate: 0,
 discount_type:"",
 discount_value: 0,
 allow_partial_payments: true,
 is_default: false,
 default_items: [],
 },
 });

 const { fields, append, remove } = useFieldArray({
 control: form.control,
 name:"default_items",
 });

 const filteredTemplates = templates.filter(template => {
 const term = searchTerm.toLowerCase();
 return (
 template.name.toLowerCase().includes(term) ||
 template.description?.toLowerCase().includes(term)
 );
 });

 const openCreateDialog = () => {
 setEditingTemplate(null);
 form.reset({
 name:"",
 description:"",
 title:"",
 notes:"",
 footer:"",
 terms_conditions:"",
 payment_terms: 30,
 tax_rate: 0,
 discount_type:"",
 discount_value: 0,
 allow_partial_payments: true,
 is_default: false,
 default_items: [],
 });
 setDialogOpen(true);
 };

 const openEditDialog = (template: InvoiceTemplate) => {
 setEditingTemplate(template);
 const defaultItems = Array.isArray(template.default_items) 
 ? template.default_items 
 : [];
 form.reset({
 name: template.name,
 description: template.description ||"",
 title: template.title ||"",
 notes: template.notes ||"",
 footer: template.footer ||"",
 terms_conditions: template.terms_conditions ||"",
 payment_terms: template.payment_terms,
 tax_rate: template.tax_rate,
 discount_type: template.discount_type ||"",
 discount_value: template.discount_value || 0,
 allow_partial_payments: template.allow_partial_payments,
 is_default: template.is_default,
 default_items: defaultItems,
 });
 setDialogOpen(true);
 };

 const handleSubmit = async (data: TemplateFormData) => {
 setSaving(true);
 try {
 const templateData = {
 ...data,
 discount_type: data.discount_type || null,
 discount_value: data.discount_value || null,
 default_items: data.default_items.length > 0 ? data.default_items : null,
 };

 if (editingTemplate) {
 await onUpdateTemplate(editingTemplate.id, templateData);
 toast.success("Template updated successfully");
 } else {
 await onCreateTemplate(templateData);
 toast.success("Template created successfully");
 }
 setDialogOpen(false);
 onRefresh();
 } catch (error) {
 toast.error("Failed to save template");
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (template: InvoiceTemplate) => {
 if (!confirm(`Are you sure you want to delete"${template.name}"?`)) return;
 
 try {
 await onDeleteTemplate(template.id);
 toast.success("Template deleted");
 onRefresh();
 } catch (error) {
 toast.error("Failed to delete template");
 }
 };

 const handleDuplicate = (template: InvoiceTemplate) => {
 setEditingTemplate(null);
 const defaultItems = Array.isArray(template.default_items) 
 ? template.default_items 
 : [];
 form.reset({
 name: `${template.name} (Copy)`,
 description: template.description ||"",
 title: template.title ||"",
 notes: template.notes ||"",
 footer: template.footer ||"",
 terms_conditions: template.terms_conditions ||"",
 payment_terms: template.payment_terms,
 tax_rate: template.tax_rate,
 discount_type: template.discount_type ||"",
 discount_value: template.discount_value || 0,
 allow_partial_payments: template.allow_partial_payments,
 is_default: false,
 default_items: defaultItems,
 });
 setDialogOpen(true);
 };

 const handleCatalogItemSelect = (item: CatalogItem) => {
 append({
 description: item.name,
 quantity: 1,
 unit_price: item.unit_price,
 unit_type: item.unit_type,
 tax_rate: item.tax_rate,
 });
 };

 const addBlankItem = () => {
 append({
 description:"",
 quantity: 1,
 unit_price: 0,
 unit_type:"item",
 tax_rate: 0,
 });
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <Skeleton className="h-10 w-full max-w-sm" />
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search templates..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-9"
 />
 </div>
 <Button onClick={openCreateDialog}>
 <Plus className="h-4 w-4 mr-2" />
 Create Template
 </Button>
 </div>

 {/* Template Grid */}
 {filteredTemplates.length === 0 ? (
 <Card>
 <CardContent className="py-12 text-center">
 <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
 <h3 className="text-lg font-semibold mb-2">No templates found</h3>
 <p className="text-muted-foreground mb-4">
 {searchTerm ?"Try adjusting your search" :"Create your first template to speed up invoice creation"}
 </p>
 {!searchTerm && (
 <Button onClick={openCreateDialog}>
 <Plus className="h-4 w-4 mr-2" />
 Create Template
 </Button>
 )}
 </CardContent>
 </Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredTemplates.map((template) => {
 const itemCount = Array.isArray(template.default_items) 
 ? template.default_items.length 
 : 0;
 
 return (
 <Card 
 key={template.id} 
 className="hover:shadow-md transition-shadow cursor-pointer group"
 onClick={() => onUseTemplate(template)}
 >
 <CardContent className="p-4">
 <div className="flex items-start justify-between">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <h3 className="font-semibold truncate">{template.name}</h3>
 {template.is_default && (
 <Badge variant="secondary" className="shrink-0">
 <span className="h-3 w-3 mr-1 fill-current" aria-hidden="true">⭐</span>
 Default
 </Badge>
 )}
 </div>
 {template.description && (
 <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
 {template.description}
 </p>
 )}
 </div>
 <DropdownMenu>
 <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
 <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUseTemplate(template); }}>
 <FileText className="h-4 w-4 mr-2" />
 Use Template
 </DropdownMenuItem>
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(template); }}>
 <Edit className="h-4 w-4 mr-2" />
 Edit
 </DropdownMenuItem>
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(template); }}>
 <Copy className="h-4 w-4 mr-2" />
 Duplicate
 </DropdownMenuItem>
 {!template.is_default && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSetDefault(template.id); }}>
 <span className="h-4 w-4 mr-2" aria-hidden="true">⭐</span>
 Set as Default
 </DropdownMenuItem>
 )}
 <DropdownMenuSeparator />
 <DropdownMenuItem 
 onClick={(e) => { e.stopPropagation(); handleDelete(template); }}
 className="text-destructive"
 >
 <Trash2 className="h-4 w-4 mr-2" />
 Delete
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>

 <div className="mt-4 flex flex-wrap gap-2 text-xs">
 <Badge variant="outline">
 Net {template.payment_terms} days
 </Badge>
 {template.tax_rate > 0 && (
 <Badge variant="outline">
 {template.tax_rate}% tax
 </Badge>
 )}
 {itemCount > 0 && (
 <Badge variant="outline">
 <Package className="h-3 w-3 mr-1" />
 {itemCount} item{itemCount !== 1 ?'s' :''}
 </Badge>
 )}
 </div>

 <p className="text-xs text-muted-foreground mt-3">
 Click to create invoice from this template
 </p>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}

 {/* Template Dialog */}
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>
 {editingTemplate ?"Edit Template" :"Create New Template"}
 </DialogTitle>
 </DialogHeader>

 <Form {...form}>
 <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
 {/* Basic Info */}
 <div className="space-y-4">
 <h4 className="font-medium">Template Info</h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="name"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Template Name *</FormLabel>
 <FormControl>
 <Input placeholder="e.g., Monthly Grooming" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="title"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Invoice Title</FormLabel>
 <FormControl>
 <Input placeholder="e.g., Grooming Services" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>
 <FormField
 control={form.control}
 name="description"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Description</FormLabel>
 <FormControl>
 <Textarea 
 placeholder="Brief description of when to use this template"
 className="min-h-[60px]"
 {...field} 
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 <Separator />

 {/* Default Items */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h4 className="font-medium">Default Line Items</h4>
 <p className="text-sm text-muted-foreground">
 These items will be pre-filled when using this template
 </p>
 </div>
 <div className="flex gap-2">
 {catalogItems.length > 0 && (
 <CatalogItemPicker
 items={catalogItems}
 onSelect={handleCatalogItemSelect}
 />
 )}
 <Button type="button" variant="outline" size="sm" onClick={addBlankItem}>
 <Plus className="h-4 w-4 mr-1" />
 Add Item
 </Button>
 </div>
 </div>

 {fields.length > 0 && (
 <div className="border rounded-lg overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-muted">
 <tr>
 <th className="text-left p-2 font-medium">Description</th>
 <th className="text-right p-2 font-medium w-20">Qty</th>
 <th className="text-right p-2 font-medium w-24">Price</th>
 <th className="text-right p-2 font-medium w-20">Tax %</th>
 <th className="w-10"></th>
 </tr>
 </thead>
 <tbody>
 {fields.map((field, index) => (
 <tr key={field.id} className="border-t">
 <td className="p-2">
 <Input
 {...form.register(`default_items.${index}.description`)}
 placeholder="Item description"
 className="h-8"
 />
 </td>
 <td className="p-2">
 <Input
 type="number"
 step="0.01"
 {...form.register(`default_items.${index}.quantity`, { valueAsNumber: true })}
 className="h-8 text-right"
 />
 </td>
 <td className="p-2">
 <Input
 type="number"
 step="0.01"
 {...form.register(`default_items.${index}.unit_price`, { valueAsNumber: true })}
 className="h-8 text-right"
 />
 </td>
 <td className="p-2">
 <Input
 type="number"
 step="0.01"
 {...form.register(`default_items.${index}.tax_rate`, { valueAsNumber: true })}
 className="h-8 text-right"
 />
 </td>
 <td className="p-2">
 <Button
 type="button"
 variant="ghost"
 size="icon"
 className="h-8 w-8 text-destructive"
 onClick={() => remove(index)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 <Separator />

 {/* Settings */}
 <div className="space-y-4">
 <h4 className="font-medium">Default Settings</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <FormField
 control={form.control}
 name="payment_terms"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Payment Terms (days)</FormLabel>
 <FormControl>
 <Input 
 type="number" 
 {...field} 
 onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="tax_rate"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Default Tax Rate (%)</FormLabel>
 <FormControl>
 <Input 
 type="number" 
 step="0.01"
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
 name="discount_type"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Default Discount</FormLabel>
 <Select value={field.value ||""} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger>
 <SelectValue placeholder="No discount" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="none">No discount</SelectItem>
 <SelectItem value="percentage">Percentage</SelectItem>
 <SelectItem value="fixed">Fixed Amount</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 {form.watch("discount_type") && form.watch("discount_type") !=="none" && (
 <FormField
 control={form.control}
 name="discount_value"
 render={({ field }) => (
 <FormItem className="max-w-xs">
 <FormLabel>
 Discount Value {form.watch("discount_type") ==="percentage" ?"(%)" :"($)"}
 </FormLabel>
 <FormControl>
 <Input 
 type="number" 
 step="0.01"
 {...field} 
 onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 )}
 </div>

 <Separator />

 {/* Notes & Terms */}
 <div className="space-y-4">
 <h4 className="font-medium">Notes & Terms</h4>
 <FormField
 control={form.control}
 name="notes"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Default Notes</FormLabel>
 <FormControl>
 <Textarea 
 placeholder="Notes to appear on the invoice"
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
 name="terms_conditions"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Terms & Conditions</FormLabel>
 <FormControl>
 <Textarea 
 placeholder="Terms and conditions"
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
 </div>

 <Separator />

 {/* Options */}
 <div className="space-y-4">
 <h4 className="font-medium">Options</h4>
 <div className="flex flex-col gap-4">
 <FormField
 control={form.control}
 name="allow_partial_payments"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between rounded-lg border p-3">
 <div>
 <FormLabel className="text-base">Allow Partial Payments</FormLabel>
 <FormDescription>
 Let clients pay in installments
 </FormDescription>
 </div>
 <FormControl>
 <Switch
 checked={field.value}
 onCheckedChange={field.onChange}
 />
 </FormControl>
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="is_default"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between rounded-lg border p-3">
 <div>
 <FormLabel className="text-base">Set as Default Template</FormLabel>
 <FormDescription>
 This template will be suggested for new invoices
 </FormDescription>
 </div>
 <FormControl>
 <Switch
 checked={field.value}
 onCheckedChange={field.onChange}
 />
 </FormControl>
 </FormItem>
 )}
 />
 </div>
 </div>

 <DialogFooter>
 <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={saving}>
 {saving ?"Saving..." : editingTemplate ?"Update Template" :"Create Template"}
 </Button>
 </DialogFooter>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 </div>
 );
}
