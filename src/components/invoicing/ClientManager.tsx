import { useState } from"react";
import { useForm } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Phone } from "lucide-react";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
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
import { Skeleton } from"@/components/ui/skeleton";
import { InvoiceClient } from"@/services/api/invoicing.service";
import { toast } from"sonner";

const clientSchema = z.object({
 name: z.string().min(1,"Name is required"),
 email: z.string().email("Valid email is required"),
 phone: z.string().optional(),
 company_name: z.string().optional(),
 address_line1: z.string().optional(),
 address_line2: z.string().optional(),
 city: z.string().optional(),
 state: z.string().optional(),
 postal_code: z.string().optional(),
 country: z.string().optional(),
 tax_id: z.string().optional(),
 notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientManagerProps {
 clients: InvoiceClient[];
 loading: boolean;
 onCreateClient: (data: Partial<InvoiceClient>) => Promise<void>;
 onUpdateClient: (clientId: string, data: Partial<InvoiceClient>) => Promise<void>;
 onDeleteClient: (clientId: string) => Promise<void>;
 onRefresh: () => void;
}

export function ClientManager({
 clients,
 loading,
 onCreateClient,
 onUpdateClient,
 onDeleteClient,
 onRefresh,
}: ClientManagerProps) {
 const [searchTerm, setSearchTerm] = useState("");
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editingClient, setEditingClient] = useState<InvoiceClient | null>(null);
 const [saving, setSaving] = useState(false);

 const form = useForm<ClientFormData>({
 resolver: zodResolver(clientSchema),
 defaultValues: {
 name:"",
 email:"",
 phone:"",
 company_name:"",
 address_line1:"",
 address_line2:"",
 city:"",
 state:"",
 postal_code:"",
 country:"US",
 tax_id:"",
 notes:"",
 },
 });

 const filteredClients = clients.filter(client => {
 const term = searchTerm.toLowerCase();
 return (
 client.name.toLowerCase().includes(term) ||
 client.email.toLowerCase().includes(term) ||
 client.company_name?.toLowerCase().includes(term)
 );
 });

 const openCreateDialog = () => {
 setEditingClient(null);
 form.reset({
 name:"",
 email:"",
 phone:"",
 company_name:"",
 address_line1:"",
 address_line2:"",
 city:"",
 state:"",
 postal_code:"",
 country:"US",
 tax_id:"",
 notes:"",
 });
 setDialogOpen(true);
 };

 const openEditDialog = (client: InvoiceClient) => {
 setEditingClient(client);
 form.reset({
 name: client.name,
 email: client.email,
 phone: client.phone ||"",
 company_name: client.company_name ||"",
 address_line1: client.address_line1 ||"",
 address_line2: client.address_line2 ||"",
 city: client.city ||"",
 state: client.state ||"",
 postal_code: client.postal_code ||"",
 country: client.country ||"US",
 tax_id: client.tax_id ||"",
 notes: client.notes ||"",
 });
 setDialogOpen(true);
 };

 const handleSubmit = async (data: ClientFormData) => {
 setSaving(true);
 try {
 if (editingClient) {
 await onUpdateClient(editingClient.id, data);
 toast.success("Client updated successfully");
 } else {
 await onCreateClient(data);
 toast.success("Client created successfully");
 }
 setDialogOpen(false);
 onRefresh();
 } catch (error) {
 toast.error("Failed to save client");
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (client: InvoiceClient) => {
 if (!confirm(`Are you sure you want to delete ${client.name}?`)) return;
 
 try {
 await onDeleteClient(client.id);
 toast.success("Client deleted");
 onRefresh();
 } catch (error) {
 toast.error("Failed to delete client");
 }
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <Skeleton className="h-10 w-full max-w-sm" />
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48" />)}
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
 placeholder="Search clients..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-9"
 />
 </div>
 <Button onClick={openCreateDialog}>
 <Plus className="h-4 w-4 mr-2" />
 Add Client
 </Button>
 </div>

 {/* Client Grid */}
 {filteredClients.length === 0 ? (
 <Card>
 <CardContent className="py-12 text-center">
 <span className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true">👥</span>
 <h3 className="text-lg font-semibold mb-2">No clients found</h3>
 <p className="text-muted-foreground mb-4">
 {searchTerm ?"Try adjusting your search" :"Add your first client to get started"}
 </p>
 {!searchTerm && (
 <Button onClick={openCreateDialog}>
 <Plus className="h-4 w-4 mr-2" />
 Add Client
 </Button>
 )}
 </CardContent>
 </Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredClients.map((client) => (
 <Card key={client.id} className="hover:shadow-md transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-start justify-between">
 <div className="flex-1 min-w-0">
 <h3 className="font-semibold truncate">{client.name}</h3>
 {client.company_name && (
 <p className="text-sm text-muted-foreground flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">🏢</span>
 {client.company_name}
 </p>
 )}
 </div>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => openEditDialog(client)}>
 <Edit className="h-4 w-4 mr-2" />
 Edit
 </DropdownMenuItem>
 <DropdownMenuItem 
 onClick={() => handleDelete(client)}
 className="text-destructive"
 >
 <Trash2 className="h-4 w-4 mr-2" />
 Delete
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>

 <div className="mt-4 space-y-2 text-sm">
 <p className="flex items-center gap-2 text-muted-foreground">
 <span className="h-4 w-4" aria-hidden="true">📧</span>
 <span className="truncate">{client.email}</span>
 </p>
 {client.phone && (
 <p className="flex items-center gap-2 text-muted-foreground">
 <span className="h-4 w-4" aria-hidden="true">📞</span>
 {client.phone}
 </p>
 )}
 {(client.city || client.state) && (
 <p className="flex items-center gap-2 text-muted-foreground">
 <span className="h-4 w-4" aria-hidden="true">📍</span>
 {[client.city, client.state].filter(Boolean).join(",")}
 </p>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 {/* Client Dialog */}
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>
 {editingClient ?"Edit Client" :"Add New Client"}
 </DialogTitle>
 </DialogHeader>

 <Form {...form}>
 <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="name"
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
 name="email"
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
 name="phone"
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
 name="company_name"
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
 name="address_line1"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Address Line 1</FormLabel>
 <FormControl>
 <Input placeholder="Street address" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <FormField
 control={form.control}
 name="address_line2"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Address Line 2</FormLabel>
 <FormControl>
 <Input placeholder="Apt, suite, etc." {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <FormField
 control={form.control}
 name="city"
 render={({ field }) => (
 <FormItem>
 <FormLabel>City</FormLabel>
 <FormControl>
 <Input placeholder="City" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="state"
 render={({ field }) => (
 <FormItem>
 <FormLabel>State</FormLabel>
 <FormControl>
 <Input placeholder="State" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="postal_code"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Postal Code</FormLabel>
 <FormControl>
 <Input placeholder="ZIP" {...field} />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="country"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Country</FormLabel>
 <Select value={field.value} onValueChange={field.onChange}>
 <FormControl>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 </FormControl>
 <SelectContent>
 <SelectItem value="US">United States</SelectItem>
 <SelectItem value="CA">Canada</SelectItem>
 <SelectItem value="UK">United Kingdom</SelectItem>
 <SelectItem value="AU">Australia</SelectItem>
 </SelectContent>
 </Select>
 <FormMessage />
 </FormItem>
 )}
 />
 </div>

 <FormField
 control={form.control}
 name="tax_id"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Tax ID / EIN</FormLabel>
 <FormControl>
 <Input placeholder="Tax identification number" {...field} />
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
 placeholder="Internal notes about this client"
 className="min-h-[80px]"
 {...field} 
 />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <DialogFooter>
 <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={saving}>
 {saving ?"Saving..." : editingClient ?"Update Client" :"Add Client"}
 </Button>
 </DialogFooter>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 </div>
 );
}
