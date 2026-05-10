import { useState, useMemo } from"react";
import { useForm } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { Plus, Search, Edit2, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Skeleton } from"@/components/ui/skeleton";
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
 DropdownMenuTrigger,
} from"@/components/ui/dropdown-menu";
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
import { Textarea } from"@/components/ui/textarea";
import { toast } from"sonner";

import { Formatters } from "@/utils/formatters";
export interface CatalogItem {
 id: string;
 merchant_id: string;
 name: string;
 description?: string | null;
 unit_price: number;
 unit_type: string;
 tax_rate: number;
 category?: string | null;
 sku?: string | null;
 is_active: boolean;
 created_at: string;
 updated_at: string;
}

const catalogItemSchema = z.object({
 name: z.string().min(1,"Name is required"),
 description: z.string().optional(),
 unit_price: z.number().min(0,"Price must be 0 or greater"),
 unit_type: z.string().default("unit"),
 tax_rate: z.number().min(0).max(100).default(0),
 category: z.string().optional(),
 sku: z.string().optional(),
});

type CatalogFormData = z.infer<typeof catalogItemSchema>;

interface CatalogManagerProps {
 items: CatalogItem[];
 loading: boolean;
 onCreateItem: (item: Partial<CatalogItem>) => Promise<void>;
 onUpdateItem: (id: string, item: Partial<CatalogItem>) => Promise<void>;
 onDeleteItem: (id: string) => Promise<void>;
 onRefresh: () => void;
}

const UNIT_TYPES = [
 { value:"unit", label:"Unit" },
 { value:"hour", label:"Hour" },
 { value:"day", label:"Day" },
 { value:"week", label:"Week" },
 { value:"month", label:"Month" },
 { value:"project", label:"Project" },
 { value:"service", label:"Service" },
];

const CATEGORIES = [
"Services",
"Products",
"Consultations",
"Grooming",
"Boarding",
"Training",
"Medical",
"Supplies",
"Other",
];

export function CatalogManager({
 items,
 loading,
 onCreateItem,
 onUpdateItem,
 onDeleteItem,
 onRefresh,
}: CatalogManagerProps) {
 const [searchTerm, setSearchTerm] = useState("");
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
 const [saving, setSaving] = useState(false);

 const form = useForm<CatalogFormData>({
 resolver: zodResolver(catalogItemSchema),
 defaultValues: {
 name:"",
 description:"",
 unit_price: 0,
 unit_type:"unit",
 tax_rate: 0,
 category:"",
 sku:"",
 },
 });

 const filteredItems = useMemo(() => {
 if (!searchTerm) return items;
 const lower = searchTerm.toLowerCase();
 return items.filter(
 (item) =>
 item.name.toLowerCase().includes(lower) ||
 item.description?.toLowerCase().includes(lower) ||
 item.category?.toLowerCase().includes(lower) ||
 item.sku?.toLowerCase().includes(lower)
 );
 }, [items, searchTerm]);

 const openCreateDialog = () => {
 setEditingItem(null);
 form.reset({
 name:"",
 description:"",
 unit_price: 0,
 unit_type:"unit",
 tax_rate: 0,
 category:"",
 sku:"",
 });
 setDialogOpen(true);
 };

 const openEditDialog = (item: CatalogItem) => {
 setEditingItem(item);
 form.reset({
 name: item.name,
 description: item.description ||"",
 unit_price: Number(item.unit_price),
 unit_type: item.unit_type ||"unit",
 tax_rate: Number(item.tax_rate) || 0,
 category: item.category ||"",
 sku: item.sku ||"",
 });
 setDialogOpen(true);
 };

 const handleSubmit = async (data: CatalogFormData) => {
 setSaving(true);
 try {
 if (editingItem) {
 await onUpdateItem(editingItem.id, data);
 toast.success("Catalog item updated");
 } else {
 await onCreateItem(data);
 toast.success("Catalog item created");
 }
 setDialogOpen(false);
 onRefresh();
 } catch (error: any) {
 toast.error(error.message ||"Failed to save item");
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (item: CatalogItem) => {
 if (!confirm(`Delete"${item.name}" from your catalog?`)) return;
 try {
 await onDeleteItem(item.id);
 toast.success("Item deleted");
 onRefresh();
 } catch (error: any) {
 toast.error(error.message ||"Failed to delete item");
 }
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <div className="flex gap-4">
 <Skeleton className="h-10 flex-1" />
 <Skeleton className="h-10 w-32" />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {[1, 2, 3, 4, 5, 6].map((i) => (
 <Skeleton key={i} className="h-32" />
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Search and Add */}
 <div className="flex flex-col sm:flex-row gap-4">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search catalog items..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-9"
 />
 </div>
 <Button onClick={openCreateDialog}>
 <Plus className="h-4 w-4 mr-2" />
 Add Item
 </Button>
 </div>

 {/* Items Grid */}
 {filteredItems.length === 0 ? (
 <Card className="p-8 text-center">
 <span className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true">📦</span>
 <h3 className="font-semibold mb-2">No catalog items</h3>
 <p className="text-muted-foreground mb-4">
 {searchTerm
 ?"No items match your search"
 :"Add products or services to quickly add them to invoices"}
 </p>
 {!searchTerm && (
 <Button onClick={openCreateDialog}>
 <Plus className="h-4 w-4 mr-2" />
 Add Your First Item
 </Button>
 )}
 </Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredItems.map((item) => (
 <Card key={item.id} className="group">
 <CardHeader className="pb-2">
 <div className="flex items-start justify-between">
 <div className="flex-1 min-w-0">
 <CardTitle className="text-base truncate">{item.name}</CardTitle>
 {item.sku && (
 <p className="text-xs text-muted-foreground mt-1">SKU: {item.sku}</p>
 )}
 </div>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => openEditDialog(item)}>
 <Edit2 className="h-4 w-4 mr-2" />
 Edit
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => handleDelete(item)}
 className="text-destructive"
 >
 <Trash2 className="h-4 w-4 mr-2" />
 Delete
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </CardHeader>
 <CardContent>
 {item.description && (
 <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
 {item.description}
 </p>
 )}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-lg font-semibold">
 {Formatters.currency(Number(item.unit_price))}
 </span>
 <span className="text-sm text-muted-foreground">
 / {item.unit_type}
 </span>
 </div>
 {item.category && (
 <Badge variant="secondary" className="text-xs">
 {item.category}
 </Badge>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 {/* Add/Edit Dialog */}
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>
 {editingItem ?"Edit Catalog Item" :"Add Catalog Item"}
 </DialogTitle>
 </DialogHeader>
 <Form {...form}>
 <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
 <FormField
 control={form.control}
 name="name"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Name *</FormLabel>
 <FormControl>
 <Input placeholder="e.g., Dog Grooming - Full Service" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="description"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Description</FormLabel>
 <FormControl>
 <Textarea
 placeholder="Optional description"
 className="min-h-[60px]"
 {...field}
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <div className="grid grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="unit_price"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Price *</FormLabel>
 <FormControl>
 <div className="relative">
 <span className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true">💵</span>
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
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="unit_type"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Unit Type</FormLabel>
 <Select value={field.value} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 {UNIT_TYPES.map((unit) => (
 <SelectItem key={unit.value} value={unit.value}>
 {unit.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="category"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Category</FormLabel>
 <Select
 value={field.value ||"none"}
 onValueChange={(v) => field.onChange(v ==="none" ?"" : v)}
 >
 <FormControl>
 <SelectTrigger>
 <SelectValue placeholder="Select category" />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="none">No Category</SelectItem>
 {CATEGORIES.map((cat) => (
 <SelectItem key={cat} value={cat}>
 {cat}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="tax_rate"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Tax Rate (%)</FormLabel>
 <FormControl>
 <Input
 type="number"
 step="0.01"
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
 </div>

 <FormField
 control={form.control}
 name="sku"
 render={({ field }) => (
 <FormItem>
 <FormLabel>SKU (Optional)</FormLabel>
 <FormControl>
 <Input placeholder="e.g., GRM-FULL-001" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <DialogFooter>
 <Button
 type="button"
 variant="outline"
 onClick={() => setDialogOpen(false)}
 >
 Cancel
 </Button>
 <Button type="submit" disabled={saving}>
 {saving ?"Saving..." : editingItem ?"Update" :"Create"}
 </Button>
 </DialogFooter>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 </div>
 );
}
