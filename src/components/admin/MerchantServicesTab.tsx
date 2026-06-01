import { useEffect, useState } from'react';
import { supabase } from'@/integrations/supabase/client';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Textarea } from'@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from'@/components/ui/dialog';
import { Badge } from'@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Switch } from'@/components/ui/switch';
import { Edit, Loader2, Plus, Search, Star, Trash2, Sparkles } from "lucide-react";

import { toast } from'sonner';

type MerchantService = {
 id: string;
 name: string;
 description: string | null;
 short_description: string | null;
 category: string;
 price_usd: number;
 price_pawbucks: number;
 billing_type: string;
 features: string[];
 icon: string | null;
 is_active: boolean;
 is_popular: boolean;
 is_new: boolean;
 display_order: number;
 created_at: string;
};

const CATEGORIES = [
 { value:'visibility', label:'Visibility & Promotion' },
 { value:'analytics', label:'Analytics & Insights' },
 { value:'growth', label:'Growth & Optimization' },
 { value:'premium', label:'Premium & Exclusive' },
];

const BILLING_TYPES = [
 { value:'one_time', label:'One-Time Purchase' },
 { value:'monthly', label:'Monthly Subscription' },
 { value:'quarterly', label:'Quarterly Subscription' },
 { value:'yearly', label:'Yearly Subscription' },
];

const ICONS = [
'Megaphone','Star','TrendingUp','BadgeCheck','BarChart3','Users', 
'Brain','Search','Sparkles','Target','GraduationCap','Palette',
'Crown','Code','Building2','LineChart','Zap','Award','Shield'
];

export function MerchantServicesTab() {
 const [services, setServices] = useState<MerchantService[]>([]);
 const [filteredServices, setFilteredServices] = useState<MerchantService[]>([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [categoryFilter, setCategoryFilter] = useState<string>('all');
 const [editDialogOpen, setEditDialogOpen] = useState(false);
 const [selectedService, setSelectedService] = useState<MerchantService | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [featuresInput, setFeaturesInput] = useState('');

 useEffect(() => {
 loadServices();
 }, []);

 useEffect(() => {
 let filtered = services;
 
 if (searchTerm) {
 filtered = filtered.filter(s =>
 s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 s.short_description?.toLowerCase().includes(searchTerm.toLowerCase())
 );
 }
 
 if (categoryFilter !=='all') {
 filtered = filtered.filter(s => s.category === categoryFilter);
 }
 
 setFilteredServices(filtered);
 }, [searchTerm, categoryFilter, services]);

 const loadServices = async () => {
 try {
 const { data, error } = await supabase
 .from('merchant_market_services')
 .select('*')
 .order('display_order', { ascending: true });

 if (error) throw error;
 
 const transformedData: MerchantService[] = (data || []).map(service => ({
 ...service,
 features: Array.isArray(service.features) 
 ? (service.features as unknown as string[]) 
 : []
 }));
 
 setServices(transformedData);
 setFilteredServices(transformedData);
 } catch (error) {
 console.error('Error loading services:', error);
 toast.error('Failed to load services');
 } finally {
 setLoading(false);
 }
 };

 const handleSaveService = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedService) return;

 setSaving(true);
 try {
 const features = featuresInput.split('\n').filter(f => f.trim());
 
 const serviceData = {
 name: selectedService.name,
 description: selectedService.description,
 short_description: selectedService.short_description,
 category: selectedService.category,
 price_usd: selectedService.price_usd,
 price_pawbucks: selectedService.price_pawbucks,
 billing_type: selectedService.billing_type,
 features: features,
 icon: selectedService.icon,
 is_active: selectedService.is_active,
 is_popular: selectedService.is_popular,
 is_new: selectedService.is_new,
 display_order: selectedService.display_order,
 };

 if (selectedService.id) {
 const { error } = await supabase
 .from('merchant_market_services')
 .update(serviceData)
 .eq('id', selectedService.id);

 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action:'UPDATE_MERCHANT_SERVICE',
 _entity_type:'merchant_market_service',
 _entity_id: selectedService.id,
 _changes: { name: selectedService.name, price_usd: selectedService.price_usd },
 });
 
 toast.success('Service updated successfully');
 } else {
 const { error } = await supabase
 .from('merchant_market_services')
 .insert([serviceData]);

 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action:'CREATE_MERCHANT_SERVICE',
 _entity_type:'merchant_market_service',
 _entity_id: null,
 _changes: { name: selectedService.name },
 });
 
 toast.success('Service created successfully');
 }

 setEditDialogOpen(false);
 loadServices();
 } catch (error: any) {
 console.error('Error saving service:', error);
 toast.error(error.message ||'Failed to save service');
 } finally {
 setSaving(false);
 }
 };

 const handleDeleteService = async (id: string, name: string) => {
 if (!confirm(`Are you sure you want to delete"${name}"?`)) return;

 try {
 const { error } = await supabase
 .from('merchant_market_services')
 .delete()
 .eq('id', id);

 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action:'DELETE_MERCHANT_SERVICE',
 _entity_type:'merchant_market_service',
 _entity_id: id,
 _changes: { name },
 });

 toast.success('Service deleted successfully');
 loadServices();
 } catch (error: any) {
 console.error('Error deleting service:', error);
 toast.error(error.message ||'Failed to delete service');
 }
 };

 const openEditDialog = (service: MerchantService | null) => {
 if (service) {
 setSelectedService(service);
 setFeaturesInput(service.features.join('\n'));
 } else {
 setSelectedService({
 id:'',
 name:'',
 description:'',
 short_description:'',
 category:'visibility',
 price_usd: 0,
 price_pawbucks: 0,
 billing_type:'one_time',
 features: [],
 icon:'Star',
 is_active: true,
 is_popular: false,
 is_new: false,
 display_order: services.length + 1,
 created_at: new Date().toISOString(),
 });
 setFeaturesInput('');
 }
 setEditDialogOpen(true);
 };

 const getCategoryLabel = (category: string) => {
 return CATEGORIES.find(c => c.value === category)?.label || category;
 };

 const getBillingLabel = (billing: string) => {
 return BILLING_TYPES.find(b => b.value === billing)?.label || billing;
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div>
 <h2 className="text-3xl font-bold">Merchant Services</h2>
 <p className="text-muted-foreground">Manage services available in the Merchant Market</p>
 </div>
 <Button onClick={() => openEditDialog(null)}>
 <Plus className="w-4 h-4 mr-2" />
 Add Service
 </Button>
 </div>

 <div className="flex flex-col sm:flex-row gap-4">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="Search services..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
 />
 </div>
 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
 <SelectTrigger className="w-full sm:w-[200px]">
 <SelectValue placeholder="Filter by category" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Categories</SelectItem>
 {CATEGORIES.map(cat => (
 <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="border rounded-lg overflow-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Service Name</TableHead>
 <TableHead>Category</TableHead>
 <TableHead>Price (USD)</TableHead>
 <TableHead>Price (PawBucks)</TableHead>
 <TableHead>Billing</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredServices.length === 0 ? (
 <TableRow>
 <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
 No services found
 </TableCell>
 </TableRow>
 ) : (
 filteredServices.map((service) => (
 <TableRow key={service.id}>
 <TableCell>
 <div className="flex items-center gap-2">
 <span className="font-medium">{service.name}</span>
 {service.is_popular && (
 <Badge variant="secondary" className="text-xs">
 <Star className="w-3 h-3 mr-1" aria-hidden="true" />Popular
 </Badge>
 )}
 {service.is_new && (
 <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
 <Sparkles className="w-3 h-3 mr-1" />New
 </Badge>
 )}
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="outline">{getCategoryLabel(service.category)}</Badge>
 </TableCell>
 <TableCell>${service.price_usd.toLocaleString()}</TableCell>
 <TableCell>{service.price_pawbucks.toLocaleString()}</TableCell>
 <TableCell>{getBillingLabel(service.billing_type)}</TableCell>
 <TableCell>
 <Badge variant={service.is_active ?'default' :'secondary'}>
 {service.is_active ?'Active' :'Inactive'}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => openEditDialog(service)}
 >
 <Edit className="w-4 h-4" />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleDeleteService(service.id, service.name)}
 >
 <Trash2 className="w-4 h-4 text-destructive" />
 </Button>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </div>

 <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
 <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>{selectedService?.id ?'Edit Service' :'Add New Service'}</DialogTitle>
 <DialogDescription>
 {selectedService?.id ?'Update service details' :'Create a new merchant market service'}
 </DialogDescription>
 </DialogHeader>
 {selectedService && (
 <form onSubmit={handleSaveService} className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Service Name *</Label>
 <Input
 value={selectedService.name}
 onChange={(e) => setSelectedService({ ...selectedService, name: e.target.value })}
 placeholder="e.g., Premium Ad Placement"
 required
 />
 </div>
 <div className="space-y-2">
 <Label>Icon</Label>
 <Select 
 value={selectedService.icon ||'Star'} 
 onValueChange={(value) => setSelectedService({ ...selectedService, icon: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select icon" />
 </SelectTrigger>
 <SelectContent>
 {ICONS.map(icon => (
 <SelectItem key={icon} value={icon}>{icon}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="space-y-2">
 <Label>Short Description</Label>
 <Input
 value={selectedService.short_description ||''}
 onChange={(e) => setSelectedService({ ...selectedService, short_description: e.target.value })}
 placeholder="Brief tagline for the service"
 />
 </div>

 <div className="space-y-2">
 <Label>Full Description</Label>
 <Textarea
 value={selectedService.description ||''}
 onChange={(e) => setSelectedService({ ...selectedService, description: e.target.value })}
 placeholder="Detailed description of what the service includes"
 rows={3}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Category *</Label>
 <Select 
 value={selectedService.category} 
 onValueChange={(value) => setSelectedService({ ...selectedService, category: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select category" />
 </SelectTrigger>
 <SelectContent>
 {CATEGORIES.map(cat => (
 <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Billing Type *</Label>
 <Select 
 value={selectedService.billing_type} 
 onValueChange={(value) => setSelectedService({ ...selectedService, billing_type: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select billing type" />
 </SelectTrigger>
 <SelectContent>
 {BILLING_TYPES.map(bt => (
 <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label>Price (USD) *</Label>
 <Input
 type="number"
 step="0.01"
 min="0"
 value={selectedService.price_usd}
 onChange={(e) => setSelectedService({ ...selectedService, price_usd: parseFloat(e.target.value) || 0 })}
 required
 />
 </div>
 <div className="space-y-2">
 <Label>Price (PawBucks) *</Label>
 <Input
 type="number"
 min="0"
 value={selectedService.price_pawbucks}
 onChange={(e) => setSelectedService({ ...selectedService, price_pawbucks: parseInt(e.target.value) || 0 })}
 required
 />
 </div>
 <div className="space-y-2">
 <Label>Display Order</Label>
 <Input
 type="number"
 min="0"
 value={selectedService.display_order}
 onChange={(e) => setSelectedService({ ...selectedService, display_order: parseInt(e.target.value) || 0 })}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>Features (one per line)</Label>
 <Textarea
 value={featuresInput}
 onChange={(e) => setFeaturesInput(e.target.value)}
 placeholder="Homepage carousel placement
Top of search results
Featured in email newsletters"
 rows={5}
 />
 </div>

 <div className="flex flex-wrap gap-6">
 <div className="flex items-center gap-2">
 <Switch
 id="is_active"
 checked={selectedService.is_active}
 onCheckedChange={(checked) => setSelectedService({ ...selectedService, is_active: checked })}
 />
 <Label htmlFor="is_active">Active</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch
 id="is_popular"
 checked={selectedService.is_popular}
 onCheckedChange={(checked) => setSelectedService({ ...selectedService, is_popular: checked })}
 />
 <Label htmlFor="is_popular">Mark as Popular</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch
 id="is_new"
 checked={selectedService.is_new}
 onCheckedChange={(checked) => setSelectedService({ ...selectedService, is_new: checked })}
 />
 <Label htmlFor="is_new">Mark as New</Label>
 </div>
 </div>

 <div className="flex justify-end gap-2">
 <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={saving}>
 {saving ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Saving...
 </>
 ) : (
 selectedService.id ?'Update Service' :'Create Service'
 )}
 </Button>
 </div>
 </form>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}