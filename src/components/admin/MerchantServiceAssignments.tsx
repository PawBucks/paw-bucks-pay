import { useEffect, useState } from'react';
import { supabase } from'@/integrations/supabase/client';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from'@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from'@/components/ui/dialog';
import { Badge } from'@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Search, Plus, Edit, Play, Pause, StopCircle, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from'sonner';
import { format, addDays, addMonths, addYears, isAfter, isBefore, differenceInDays } from'date-fns';

type Merchant = {
 id: string;
 business_name: string;
 email: string | null;
 user_id: string;
};

type MerchantService = {
 id: string;
 name: string;
 short_description: string | null;
 category: string;
 price_usd: number;
 price_pawbucks: number;
 billing_type: string;
};

type ServiceAssignment = {
 id: string;
 merchant_id: string;
 service_id: string;
 status: string;
 amount_paid_usd: number | null;
 amount_paid_pawbucks: number | null;
 expires_at: string | null;
 created_at: string;
 updated_at: string;
 service?: MerchantService;
 merchant?: Merchant;
};

const STATUS_OPTIONS = [
 { value:'active', label:'Active', color:'bg-success' },
 { value:'pending', label:'Pending', color:'bg-warning' },
 { value:'paused', label:'Paused', color:'bg-warning' },
 { value:'expired', label:'Expired', color:'bg-muted-foreground' },
 { value:'cancelled', label:'Cancelled', color:'bg-destructive' },
];

const DURATION_OPTIONS = [
 { value:'7d', label:'7 Days' },
 { value:'30d', label:'30 Days' },
 { value:'90d', label:'90 Days' },
 { value:'1y', label:'1 Year' },
 { value:'custom', label:'Custom Date' },
 { value:'unlimited', label:'Unlimited' },
];

export function MerchantServiceAssignments() {
 const [merchants, setMerchants] = useState<Merchant[]>([]);
 const [services, setServices] = useState<MerchantService[]>([]);
 const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
 const [filteredAssignments, setFilteredAssignments] = useState<ServiceAssignment[]>([]);
 
 const [searchTerm, setSearchTerm] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [selectedMerchantFilter, setSelectedMerchantFilter] = useState<string>('all');
 
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 
 const [assignDialogOpen, setAssignDialogOpen] = useState(false);
 const [editDialogOpen, setEditDialogOpen] = useState(false);
 const [selectedAssignment, setSelectedAssignment] = useState<ServiceAssignment | null>(null);
 
 // New assignment form state
 const [newAssignment, setNewAssignment] = useState({
 merchant_id:'',
 service_id:'',
 duration:'30d',
 custom_date:'',
 status:'active',
 notes:'',
 });

 useEffect(() => {
 loadData();
 }, []);

 useEffect(() => {
 filterAssignments();
 }, [searchTerm, statusFilter, selectedMerchantFilter, assignments]);

 const loadData = async () => {
 try {
 // Load merchants
 const { data: merchantsData, error: merchantsError } = await supabase
 .from('merchants')
 .select('id, business_name, email, user_id')
 .order('business_name');
 
 if (merchantsError) throw merchantsError;
 setMerchants(merchantsData || []);

 // Load available services
 const { data: servicesData, error: servicesError } = await supabase
 .from('merchant_market_services')
 .select('id, name, short_description, category, price_usd, price_pawbucks, billing_type')
 .eq('is_active', true)
 .order('display_order');
 
 if (servicesError) throw servicesError;
 setServices(servicesData || []);

 // Load existing assignments with service and merchant details
 const { data: assignmentsData, error: assignmentsError } = await supabase
 .from('merchant_service_purchases')
 .select(`
 *,
 service:merchant_market_services(id, name, short_description, category, price_usd, price_pawbucks, billing_type),
 merchant:merchants(id, business_name, email, user_id)
 `)
 .order('created_at', { ascending: false });
 
 if (assignmentsError) throw assignmentsError;
 setAssignments(assignmentsData || []);
 } catch (error) {
 console.error('Error loading data:', error);
 toast.error('Failed to load data');
 } finally {
 setLoading(false);
 }
 };

 const filterAssignments = () => {
 let filtered = assignments;

 if (searchTerm) {
 const search = searchTerm.toLowerCase();
 filtered = filtered.filter(a =>
 a.merchant?.business_name?.toLowerCase().includes(search) ||
 a.service?.name?.toLowerCase().includes(search)
 );
 }

 if (statusFilter !=='all') {
 filtered = filtered.filter(a => a.status === statusFilter);
 }

 if (selectedMerchantFilter !=='all') {
 filtered = filtered.filter(a => a.merchant_id === selectedMerchantFilter);
 }

 setFilteredAssignments(filtered);
 };

 const calculateExpirationDate = (duration: string, customDate: string): string | null => {
 const now = new Date();
 switch (duration) {
 case'7d': return addDays(now, 7).toISOString();
 case'30d': return addDays(now, 30).toISOString();
 case'90d': return addDays(now, 90).toISOString();
 case'1y': return addYears(now, 1).toISOString();
 case'custom': return customDate ? new Date(customDate).toISOString() : null;
 case'unlimited': return null;
 default: return addDays(now, 30).toISOString();
 }
 };

 const handleAssignService = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newAssignment.merchant_id || !newAssignment.service_id) {
 toast.error('Please select a merchant and service');
 return;
 }

 setSaving(true);
 try {
 const expiresAt = calculateExpirationDate(newAssignment.duration, newAssignment.custom_date);
 const selectedService = services.find(s => s.id === newAssignment.service_id);

 const { error } = await supabase
 .from('merchant_service_purchases')
 .insert({
 merchant_id: newAssignment.merchant_id,
 service_id: newAssignment.service_id,
 status: newAssignment.status,
 expires_at: expiresAt,
 amount_paid_usd: 0, // Admin assigned - no payment
 amount_paid_pawbucks: 0,
 });

 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action:'ASSIGN_MERCHANT_SERVICE',
 _entity_type:'merchant_service_purchase',
 _entity_id: newAssignment.merchant_id,
 _changes: {
 service_name: selectedService?.name,
 merchant_id: newAssignment.merchant_id,
 status: newAssignment.status,
 expires_at: expiresAt,
 },
 });

 toast.success('Service assigned to merchant successfully');
 setAssignDialogOpen(false);
 setNewAssignment({
 merchant_id:'',
 service_id:'',
 duration:'30d',
 custom_date:'',
 status:'active',
 notes:'',
 });
 loadData();
 } catch (error: any) {
 console.error('Error assigning service:', error);
 toast.error(error.message ||'Failed to assign service');
 } finally {
 setSaving(false);
 }
 };

 const handleUpdateAssignment = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedAssignment) return;

 setSaving(true);
 try {
 const { error } = await supabase
 .from('merchant_service_purchases')
 .update({
 status: selectedAssignment.status,
 expires_at: selectedAssignment.expires_at,
 updated_at: new Date().toISOString(),
 })
 .eq('id', selectedAssignment.id);

 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action:'UPDATE_MERCHANT_SERVICE_ASSIGNMENT',
 _entity_type:'merchant_service_purchase',
 _entity_id: selectedAssignment.id,
 _changes: {
 service_name: selectedAssignment.service?.name,
 merchant_name: selectedAssignment.merchant?.business_name,
 status: selectedAssignment.status,
 expires_at: selectedAssignment.expires_at,
 },
 });

 toast.success('Service assignment updated');
 setEditDialogOpen(false);
 setSelectedAssignment(null);
 loadData();
 } catch (error: any) {
 console.error('Error updating assignment:', error);
 toast.error(error.message ||'Failed to update assignment');
 } finally {
 setSaving(false);
 }
 };

 const handleQuickStatusChange = async (assignment: ServiceAssignment, newStatus: string) => {
 try {
 const { error } = await supabase
 .from('merchant_service_purchases')
 .update({
 status: newStatus,
 updated_at: new Date().toISOString(),
 })
 .eq('id', assignment.id);

 if (error) throw error;

 await supabase.rpc('log_admin_action', {
 _action: `${newStatus.toUpperCase()}_MERCHANT_SERVICE`,
 _entity_type:'merchant_service_purchase',
 _entity_id: assignment.id,
 _changes: {
 service_name: assignment.service?.name,
 merchant_name: assignment.merchant?.business_name,
 old_status: assignment.status,
 new_status: newStatus,
 },
 });

 toast.success(`Service ${newStatus}`);
 loadData();
 } catch (error: any) {
 console.error('Error updating status:', error);
 toast.error('Failed to update status');
 }
 };

 const getStatusBadge = (status: string) => {
 const statusOption = STATUS_OPTIONS.find(s => s.value === status);
 const icons: Record<string, React.ReactNode> = {
 active: <CheckCircle className="w-3 h-3 mr-1" />,
 pending: <span className="w-3 h-3 mr-1" aria-hidden="true">⏰</span>,
 paused: <Pause className="w-3 h-3 mr-1" />,
 expired: <AlertCircle className="w-3 h-3 mr-1" />,
 cancelled: <XCircle className="w-3 h-3 mr-1" />,
 };

 return (
 <Badge 
 variant={status ==='active' ?'default' :'secondary'}
 className={`${status ==='active' ?'bg-success' : status ==='paused' ?'bg-warning' :''}`}
 >
 {icons[status]}
 {statusOption?.label || status}
 </Badge>
 );
 };

 const openEditDialog = (assignment: ServiceAssignment) => {
 setSelectedAssignment(assignment);
 setEditDialogOpen(true);
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
 <h2 className="text-3xl font-bold">Merchant Service Assignments</h2>
 <p className="text-muted-foreground">
 Assign and manage services for individual merchants
 </p>
 </div>
 <Button onClick={() => setAssignDialogOpen(true)}>
 <Plus className="w-4 h-4 mr-2" />
 Assign Service
 </Button>
 </div>

 {/* Summary Cards */}
 <div className="grid gap-4 md:grid-cols-5">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Active Services
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-success">
 {assignments.filter(a => a.status ==='active').length}
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Expiring Soon
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-warning">
 {assignments.filter(a => {
 if (a.status !=='active' || !a.expires_at) return false;
 const daysUntilExpiry = differenceInDays(new Date(a.expires_at), new Date());
 return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
 }).length}
 </div>
 <p className="text-xs text-muted-foreground">Within 7 days</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Pending
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-warning">
 {assignments.filter(a => a.status ==='pending').length}
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Paused
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-warning">
 {assignments.filter(a => a.status ==='paused').length}
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Merchants with Services
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">
 {new Set(assignments.map(a => a.merchant_id)).size}
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Filters */}
 <div className="flex flex-col sm:flex-row gap-4">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="Search by merchant or service..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
 />
 </div>
 <Select value={selectedMerchantFilter} onValueChange={setSelectedMerchantFilter}>
 <SelectTrigger className="w-full sm:w-[200px]">
 <SelectValue placeholder="Filter by merchant" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Merchants</SelectItem>
 {merchants.map(m => (
 <SelectItem key={m.id} value={m.id}>{m.business_name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-full sm:w-[150px]">
 <SelectValue placeholder="Filter by status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 {STATUS_OPTIONS.map(s => (
 <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Assignments Table */}
 <div className="border rounded-lg overflow-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Merchant</TableHead>
 <TableHead>Service</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Expires</TableHead>
 <TableHead>Created</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredAssignments.length === 0 ? (
 <TableRow>
 <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
 No service assignments found
 </TableCell>
 </TableRow>
 ) : (
 filteredAssignments.map((assignment) => (
 <TableRow key={assignment.id}>
 <TableCell>
 <div className="flex items-center gap-2">
 <span className="w-4 h-4 text-muted-foreground" aria-hidden="true">🏪</span>
 <span className="font-medium">{assignment.merchant?.business_name}</span>
 </div>
 </TableCell>
 <TableCell>
 <div>
 <p className="font-medium">{assignment.service?.name}</p>
 <p className="text-xs text-muted-foreground">
 {assignment.service?.category}
 </p>
 </div>
 </TableCell>
 <TableCell>{getStatusBadge(assignment.status)}</TableCell>
 <TableCell>
 {assignment.expires_at ? (
 (() => {
 const expiryDate = new Date(assignment.expires_at);
 const daysUntilExpiry = differenceInDays(expiryDate, new Date());
 const isExpired = daysUntilExpiry < 0;
 const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
 
 return (
 <div className={`flex items-center gap-1 text-sm ${isExpired ?'text-destructive' : isExpiringSoon ?'text-warning' :''}`}>
 <span className="w-3 h-3" aria-hidden="true">📅</span>
 <span>{format(expiryDate,'MMM d, yyyy')}</span>
 {isExpiringSoon && !isExpired && (
 <Badge variant="outline" className="ml-1 text-xs bg-warning/10 text-warning border-warning/30">
 {daysUntilExpiry === 0 ?'Today' : `${daysUntilExpiry}d left`}
 </Badge>
 )}
 </div>
 );
 })()
 ) : (
 <span className="text-muted-foreground text-sm">No expiration</span>
 )}
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {format(new Date(assignment.created_at),'MMM d, yyyy')}
 </TableCell>
 <TableCell>
 <div className="flex items-center justify-end gap-1">
 {assignment.status ==='active' && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleQuickStatusChange(assignment,'paused')}
 title="Pause Service"
 >
 <Pause className="w-4 h-4 text-warning" />
 </Button>
 )}
 {assignment.status ==='paused' && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleQuickStatusChange(assignment,'active')}
 title="Resume Service"
 >
 <Play className="w-4 h-4 text-success" />
 </Button>
 )}
 {assignment.status !=='cancelled' && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleQuickStatusChange(assignment,'cancelled')}
 title="Cancel Service"
 >
 <StopCircle className="w-4 h-4 text-destructive" />
 </Button>
 )}
 <Button
 variant="ghost"
 size="sm"
 onClick={() => openEditDialog(assignment)}
 title="Edit Assignment"
 >
 <Edit className="w-4 h-4" />
 </Button>
 </div>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </div>

 {/* Assign Service Dialog */}
 <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>Assign Service to Merchant</DialogTitle>
 <DialogDescription>
 Select a merchant and service to create a new assignment
 </DialogDescription>
 </DialogHeader>
 <form onSubmit={handleAssignService} className="space-y-4">
 <div className="space-y-2">
 <Label>Merchant *</Label>
 <Select 
 value={newAssignment.merchant_id} 
 onValueChange={(value) => setNewAssignment({ ...newAssignment, merchant_id: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select merchant" />
 </SelectTrigger>
 <SelectContent>
 {merchants.map(m => (
 <SelectItem key={m.id} value={m.id}>
 {m.business_name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Service *</Label>
 <Select 
 value={newAssignment.service_id} 
 onValueChange={(value) => setNewAssignment({ ...newAssignment, service_id: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select service" />
 </SelectTrigger>
 <SelectContent>
 {services.map(s => (
 <SelectItem key={s.id} value={s.id}>
 {s.name} - ${s.price_usd}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Duration</Label>
 <Select 
 value={newAssignment.duration} 
 onValueChange={(value) => setNewAssignment({ ...newAssignment, duration: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select duration" />
 </SelectTrigger>
 <SelectContent>
 {DURATION_OPTIONS.map(d => (
 <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {newAssignment.duration ==='custom' && (
 <div className="space-y-2">
 <Label>Custom Expiration Date</Label>
 <Input
 type="date"
 value={newAssignment.custom_date}
 onChange={(e) => setNewAssignment({ ...newAssignment, custom_date: e.target.value })}
 min={format(new Date(),'yyyy-MM-dd')}
 />
 </div>
 )}

 <div className="space-y-2">
 <Label>Initial Status</Label>
 <Select 
 value={newAssignment.status} 
 onValueChange={(value) => setNewAssignment({ ...newAssignment, status: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="active">Active</SelectItem>
 <SelectItem value="pending">Pending</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="flex justify-end gap-2 pt-4">
 <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={saving}>
 {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
 Assign Service
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>

 {/* Edit Assignment Dialog */}
 <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>Edit Service Assignment</DialogTitle>
 <DialogDescription>
 Update the status and expiration for this assignment
 </DialogDescription>
 </DialogHeader>
 {selectedAssignment && (
 <form onSubmit={handleUpdateAssignment} className="space-y-4">
 <div className="p-4 bg-muted rounded-lg">
 <p className="font-medium">{selectedAssignment.merchant?.business_name}</p>
 <p className="text-sm text-muted-foreground">{selectedAssignment.service?.name}</p>
 </div>

 <div className="space-y-2">
 <Label>Status</Label>
 <Select 
 value={selectedAssignment.status} 
 onValueChange={(value) => setSelectedAssignment({ ...selectedAssignment, status: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select status" />
 </SelectTrigger>
 <SelectContent>
 {STATUS_OPTIONS.map(s => (
 <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Expiration Date</Label>
 <Input
 type="datetime-local"
 value={selectedAssignment.expires_at 
 ? format(new Date(selectedAssignment.expires_at),"yyyy-MM-dd'T'HH:mm")
 :''
 }
 onChange={(e) => setSelectedAssignment({ 
 ...selectedAssignment, 
 expires_at: e.target.value ? new Date(e.target.value).toISOString() : null 
 })}
 />
 <p className="text-xs text-muted-foreground">Leave empty for no expiration</p>
 </div>

 <div className="flex justify-end gap-2 pt-4">
 <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={saving}>
 {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
 Save Changes
 </Button>
 </div>
 </form>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}
