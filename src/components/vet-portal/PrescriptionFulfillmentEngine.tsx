import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from"@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from"@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { toast } from"sonner";
import { Pill, Package, DollarSign, CheckCircle, Clock, Truck, Search, Plus, AlertCircle } from"lucide-react";
import { format } from"date-fns";

import { Formatters } from "@/utils/formatters";
interface PrescriptionFulfillmentEngineProps {
 vetId: string;
}

interface PendingRefill {
 id: string;
 petId: string;
 petName: string;
 ownerName: string;
 ownerId: string;
 medicationName: string;
 dosage: string;
 quantity: number;
 reason: string;
 status: string;
 createdAt: string;
}

interface Fulfillment {
 id: string;
 petName: string;
 ownerName: string;
 medicationName: string;
 dosage: string;
 quantity: number;
 productPrice: number | null;
 vetEarnings: number | null;
 status: string;
 approvedAt: string | null;
 shippedAt: string | null;
 trackingNumber: string | null;
 createdAt: string;
}

interface StoreItem {
 id: string;
 name: string;
 description: string | null;
 price: number;
 category: string;
 stock_quantity: number;
 is_active: boolean;
}

export function PrescriptionFulfillmentEngine({ vetId }: PrescriptionFulfillmentEngineProps) {
 const [pendingRefills, setPendingRefills] = useState<PendingRefill[]>([]);
 const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
 const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [selectedRefill, setSelectedRefill] = useState<PendingRefill | null>(null);
 const [showApproveDialog, setShowApproveDialog] = useState(false);
 const [selectedStoreItem, setSelectedStoreItem] = useState<string>("");
 const [instructions, setInstructions] = useState("");
 const [vetMargin, setVetMargin] = useState(15);
 const [isProcessing, setIsProcessing] = useState(false);
 const [searchQuery, setSearchQuery] = useState("");
 const [earnings, setEarnings] = useState({ total: 0, pending: 0, paid: 0 });

 useEffect(() => {
 loadData();
 }, [vetId]);

 const loadData = async () => {
 try {
 // Load pending refill requests
 const { data: refills, error: refillsError } = await supabase
 .from("prescription_refill_requests")
 .select(`
 id,
 pet_id,
 user_id,
 medication_name,
 current_dosage,
 quantity_requested,
 reason,
 status,
 created_at,
 pet_profiles!inner(name),
 profiles!inner(full_name)
 `)
 .eq("vet_id", vetId)
 .eq("status","pending")
 .order("created_at", { ascending: false });

 if (refillsError) throw refillsError;

 const pendingList: PendingRefill[] = (refills || []).map(r => ({
 id: r.id,
 petId: r.pet_id,
 petName: (r.pet_profiles as any).name,
 ownerName: (r.profiles as any).full_name ||"Unknown",
 ownerId: r.user_id,
 medicationName: r.medication_name,
 dosage: r.current_dosage,
 quantity: r.quantity_requested,
 reason: r.reason ||"",
 status: r.status,
 createdAt: r.created_at,
 }));

 setPendingRefills(pendingList);

 // Load existing fulfillments
 const { data: fulfillmentData, error: fulfillmentError } = await supabase
 .from("vet_prescription_fulfillments")
 .select(`
 id,
 pet_id,
 medication_name,
 dosage,
 quantity,
 product_price,
 vet_earnings,
 status,
 approved_at,
 shipped_at,
 tracking_number,
 created_at,
 pet_profiles!inner(name, user_id),
 profiles!inner(full_name)
 `)
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false });

 if (fulfillmentError) throw fulfillmentError;

 const fulfillmentList: Fulfillment[] = (fulfillmentData || []).map(f => ({
 id: f.id,
 petName: (f.pet_profiles as any).name,
 ownerName: (f.profiles as any).full_name ||"Unknown",
 medicationName: f.medication_name,
 dosage: f.dosage,
 quantity: f.quantity,
 productPrice: f.product_price,
 vetEarnings: f.vet_earnings,
 status: f.status,
 approvedAt: f.approved_at,
 shippedAt: f.shipped_at,
 trackingNumber: f.tracking_number,
 createdAt: f.created_at,
 }));

 setFulfillments(fulfillmentList);

 // Calculate earnings
 const totalEarnings = fulfillmentList.reduce((sum, f) => sum + (f.vetEarnings || 0), 0);
 const pendingEarnings = fulfillmentList
 .filter(f => f.status !=="delivered")
 .reduce((sum, f) => sum + (f.vetEarnings || 0), 0);
 const paidEarnings = fulfillmentList
 .filter(f => f.status ==="delivered")
 .reduce((sum, f) => sum + (f.vetEarnings || 0), 0);

 setEarnings({ total: totalEarnings, pending: pendingEarnings, paid: paidEarnings });

 // Load pharmacy store items
 const { data: items, error: itemsError } = await supabase
 .from("pet_store_items")
 .select("id, name, description, price, category, stock_quantity, is_active")
 .eq("is_active", true)
 .gt("stock_quantity", 0)
 .order("name");

 if (!itemsError && items) {
 setStoreItems(items as StoreItem[]);
 }
 } catch (error) {
 console.error("Error loading data:", error);
 toast.error("Failed to load prescription data");
 } finally {
 setIsLoading(false);
 }
 };

 const approveAndFulfill = async () => {
 if (!selectedRefill) return;

 setIsProcessing(true);
 try {
 const selectedItem = storeItems.find(i => i.id === selectedStoreItem);
 const productPrice = selectedItem?.price || 0;
 const vetEarningsAmount = productPrice * (vetMargin / 100);

 // Create fulfillment record
 const { error: fulfillmentError } = await supabase
 .from("vet_prescription_fulfillments")
 .insert({
 vet_id: vetId,
 pet_id: selectedRefill.petId,
 user_id: selectedRefill.ownerId,
 refill_request_id: selectedRefill.id,
 store_item_id: selectedStoreItem || null,
 medication_name: selectedRefill.medicationName,
 dosage: selectedRefill.dosage,
 quantity: selectedRefill.quantity,
 instructions,
 vet_margin_percent: vetMargin,
 product_price: productPrice,
 vet_earnings: vetEarningsAmount,
 status:"approved",
 approved_at: new Date().toISOString(),
 });

 if (fulfillmentError) throw fulfillmentError;

 // Update the refill request status
 const { error: updateError } = await supabase
 .from("prescription_refill_requests")
 .update({
 status:"approved",
 approved_at: new Date().toISOString(),
 fulfillment_type:"pawbucks_store",
 fulfillment_notes: `Fulfilled via PawBucks Store. ${instructions}`,
 })
 .eq("id", selectedRefill.id);

 if (updateError) throw updateError;

 // Notify the pet owner
 await supabase.from("notifications").insert({
 user_id: selectedRefill.ownerId,
 title:"Prescription Approved!",
 message: `Your prescription refill for ${selectedRefill.medicationName} has been approved and will ship from the PawBucks Store.`,
 category:"transactional",
 });

 toast.success("Prescription approved and fulfillment created!");
 setShowApproveDialog(false);
 setSelectedRefill(null);
 setSelectedStoreItem("");
 setInstructions("");
 loadData();
 } catch (error) {
 console.error("Error approving prescription:", error);
 toast.error("Failed to approve prescription");
 } finally {
 setIsProcessing(false);
 }
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case"pending_approval":
 return <Badge variant="outline" className="bg-warning/10 text-warning"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
 case"approved":
 return <Badge className="bg-info/10 text-info"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
 case"shipped":
 return <Badge className="bg-primary/10 text-primary"><Truck className="h-3 w-3 mr-1" /> Shipped</Badge>;
 case"delivered":
 return <Badge className="bg-success/10 text-success"><Package className="h-3 w-3 mr-1" /> Delivered</Badge>;
 case"cancelled":
 return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
 default:
 return <Badge variant="outline">{status}</Badge>;
 }
 };

 const filteredFulfillments = fulfillments.filter(f => 
 searchQuery ==="" ||
 f.medicationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
 f.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
 f.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
 );

 if (isLoading) {
 return (
 <Card>
 <CardContent className="flex items-center justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
 </CardContent>
 </Card>
 );
 }

 return (
 <div className="space-y-6">
 {/* Earnings Overview */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card className="bg-gradient-to-br from-success/20 to-success/20 /20 /20">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Total Earnings</p>
 <p className="text-2xl font-bold text-success">{Formatters.currency(earnings.total)}</p>
 </div>
 <DollarSign className="h-8 w-8 text-success opacity-50" />
 </div>
 </CardContent>
 </Card>
 <Card className="bg-gradient-to-br from-info/20 to-info/20 /20 /20">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Pending</p>
 <p className="text-2xl font-bold text-info">{Formatters.currency(earnings.pending)}</p>
 </div>
 <Clock className="h-8 w-8 text-info opacity-50" />
 </div>
 </CardContent>
 </Card>
 <Card className="bg-gradient-to-br from-primary/20 to-primary/20 /20 /20">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Fulfilled Orders</p>
 <p className="text-2xl font-bold text-primary">{fulfillments.length}</p>
 </div>
 <Package className="h-8 w-8 text-primary opacity-50" />
 </div>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="pending" className="space-y-4">
 <TabsList>
 <TabsTrigger value="pending" className="flex items-center gap-2">
 <Clock className="h-4 w-4" />
 Pending Requests ({pendingRefills.length})
 </TabsTrigger>
 <TabsTrigger value="fulfillments" className="flex items-center gap-2">
 <Package className="h-4 w-4" />
 Fulfillments
 </TabsTrigger>
 </TabsList>

 <TabsContent value="pending">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Pill className="h-5 w-5" />
 Pending Prescription Refills
 </CardTitle>
 <CardDescription>
 Approve prescriptions to fulfill through the PawBucks Store and earn a margin on each sale
 </CardDescription>
 </CardHeader>
 <CardContent>
 {pendingRefills.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
 <p>No pending prescription requests</p>
 </div>
 ) : (
 <div className="border rounded-lg overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Pet</TableHead>
 <TableHead>Owner</TableHead>
 <TableHead>Medication</TableHead>
 <TableHead>Dosage</TableHead>
 <TableHead>Qty</TableHead>
 <TableHead>Requested</TableHead>
 <TableHead></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {pendingRefills.map((refill) => (
 <TableRow key={refill.id}>
 <TableCell className="font-medium">{refill.petName}</TableCell>
 <TableCell>{refill.ownerName}</TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <Pill className="h-4 w-4 text-muted-foreground" />
 {refill.medicationName}
 </div>
 </TableCell>
 <TableCell className="text-sm">{refill.dosage}</TableCell>
 <TableCell>{refill.quantity}</TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {format(new Date(refill.createdAt),"MMM d, yyyy")}
 </TableCell>
 <TableCell>
 <Dialog open={showApproveDialog && selectedRefill?.id === refill.id} onOpenChange={(open) => {
 setShowApproveDialog(open);
 if (!open) setSelectedRefill(null);
 }}>
 <DialogTrigger asChild>
 <Button size="sm" onClick={() => setSelectedRefill(refill)}>
 <CheckCircle className="h-4 w-4 mr-1" />
 Approve & Fulfill
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>Approve Prescription</DialogTitle>
 <DialogDescription>
 Fulfill this prescription through the PawBucks Store
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <div className="bg-muted p-3 rounded-lg">
 <p className="font-medium">{refill.medicationName}</p>
 <p className="text-sm text-muted-foreground">
 {refill.dosage} • Qty: {refill.quantity}
 </p>
 <p className="text-sm">For: {refill.petName} ({refill.ownerName})</p>
 </div>

 <div className="space-y-2">
 <Label>Link to Store Product (optional)</Label>
 <Select value={selectedStoreItem} onValueChange={setSelectedStoreItem}>
 <SelectTrigger>
 <SelectValue placeholder="Select a product from PawBucks Store" />
 </SelectTrigger>
 <SelectContent>
 {storeItems.map(item => (
 <SelectItem key={item.id} value={item.id}>
 {item.name} - {Formatters.currency(item.price)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-xs text-muted-foreground">
 Link to a store product to track inventory and pricing
 </p>
 </div>

 <div className="space-y-2">
 <Label>Your Margin (%)</Label>
 <Select value={vetMargin.toString()} onValueChange={(v) => setVetMargin(parseInt(v))}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="10">10%</SelectItem>
 <SelectItem value="15">15% (Default)</SelectItem>
 <SelectItem value="20">20%</SelectItem>
 <SelectItem value="25">25%</SelectItem>
 </SelectContent>
 </Select>
 {selectedStoreItem && (
 <p className="text-sm text-success">
 You'll earn {Formatters.currency(((storeItems.find(i => i.id === selectedStoreItem)?.price || 0) * (vetMargin / 100)))} on this sale
 </p>
 )}
 </div>

 <div className="space-y-2">
 <Label>Instructions for Patient</Label>
 <Textarea
 placeholder="Add any special instructions..."
 value={instructions}
 onChange={(e) => setInstructions(e.target.value)}
 rows={3}
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
 Cancel
 </Button>
 <Button onClick={approveAndFulfill} disabled={isProcessing}>
 {isProcessing ?"Processing..." :"Approve & Send to Store"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="fulfillments">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Package className="h-5 w-5" />
 Prescription Fulfillments
 </CardTitle>
 <CardDescription>
 Track prescriptions fulfilled through the PawBucks Store
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search fulfillments..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-10"
 />
 </div>

 {filteredFulfillments.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
 <p>No fulfillments yet</p>
 <p className="text-sm">Approve prescriptions to start earning</p>
 </div>
 ) : (
 <div className="border rounded-lg overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Medication</TableHead>
 <TableHead>Pet</TableHead>
 <TableHead>Owner</TableHead>
 <TableHead>Price</TableHead>
 <TableHead>Your Earnings</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Date</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredFulfillments.map((f) => (
 <TableRow key={f.id}>
 <TableCell>
 <div>
 <p className="font-medium">{f.medicationName}</p>
 <p className="text-xs text-muted-foreground">{f.dosage} × {f.quantity}</p>
 </div>
 </TableCell>
 <TableCell>{f.petName}</TableCell>
 <TableCell>{f.ownerName}</TableCell>
 <TableCell>${f.productPrice?.toFixed(2) ||"—"}</TableCell>
 <TableCell className="text-success font-medium">
 ${f.vetEarnings?.toFixed(2) ||"—"}
 </TableCell>
 <TableCell>{getStatusBadge(f.status)}</TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {format(new Date(f.createdAt),"MMM d, yyyy")}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
}
