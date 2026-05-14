import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Textarea } from"@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Label } from"@/components/ui/label";
import { Check, Clock, Loader2, Package, Pill, X } from "lucide-react";
import { format, parseISO } from"date-fns";
import { toast } from"sonner";

type RefillRequest = {
 id: string;
 pet_id: string;
 user_id: string;
 medication_name: string;
 current_dosage: string | null;
 quantity_requested: number;
 reason: string | null;
 status: string;
 vet_notes: string | null;
 fulfillment_type: string | null;
 fulfillment_notes: string | null;
 created_at: string;
 approved_at: string | null;
 pet?: {
 id: string;
 name: string;
 type: string;
 };
 owner?: {
 full_name: string;
 phone: string;
 };
};

type PrescriptionRefillsTabProps = {
 vetId: string;
};

const FULFILLMENT_OPTIONS = [
 { value:"pawbucks_store", label:"PawBucks Store" },
 { value:"partner_pharmacy", label:"Partner Pharmacy" },
 { value:"in_clinic", label:"In-Clinic Pickup" },
 { value:"other", label:"Other" },
];

export const PrescriptionRefillsTab = ({ vetId }: PrescriptionRefillsTabProps) => {
 const [requests, setRequests] = useState<RefillRequest[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [processingId, setProcessingId] = useState<string | null>(null);
 const [selectedRequest, setSelectedRequest] = useState<RefillRequest | null>(null);
 const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
 const [approvalData, setApprovalData] = useState({
 vet_notes:"",
 fulfillment_type:"in_clinic",
 fulfillment_notes:"",
 });

 useEffect(() => {
 loadRequests();
 }, [vetId]);

 const loadRequests = async () => {
 try {
 const { data, error } = await supabase
 .from("prescription_refill_requests")
 .select(`
 *,
 pet:pet_profiles(id, name, type)
 `)
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false });

 if (error) throw error;

 // Get owner info for each request
 const userIds = [...new Set(data?.map(r => r.user_id) || [])];
 const { data: profilesData } = await supabase
 .from("profiles")
 .select("id, full_name, phone")
 .in("id", userIds);

 const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

 const enrichedRequests = data?.map(r => ({
 ...r,
 owner: profilesMap.get(r.user_id),
 })) || [];

 setRequests(enrichedRequests);
 } catch (error) {
 console.error("Error loading refill requests:", error);
 toast.error("Failed to load refill requests");
 } finally {
 setIsLoading(false);
 }
 };

 const handleApprove = async () => {
 if (!selectedRequest) return;

 setProcessingId(selectedRequest.id);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 
 const { error } = await supabase
 .from("prescription_refill_requests")
 .update({
 status:"approved",
 vet_notes: approvalData.vet_notes || null,
 fulfillment_type: approvalData.fulfillment_type,
 fulfillment_notes: approvalData.fulfillment_notes || null,
 approved_at: new Date().toISOString(),
 approved_by: user?.id,
 })
 .eq("id", selectedRequest.id);

 if (error) throw error;

 toast.success("Prescription refill approved");
 setIsApproveDialogOpen(false);
 setSelectedRequest(null);
 setApprovalData({ vet_notes:"", fulfillment_type:"in_clinic", fulfillment_notes:"" });
 loadRequests();
 } catch (error: any) {
 console.error("Error approving request:", error);
 toast.error(error.message ||"Failed to approve request");
 } finally {
 setProcessingId(null);
 }
 };

 const handleDeny = async (requestId: string, reason?: string) => {
 setProcessingId(requestId);
 try {
 const { error } = await supabase
 .from("prescription_refill_requests")
 .update({
 status:"denied",
 vet_notes: reason ||"Request denied by veterinarian",
 })
 .eq("id", requestId);

 if (error) throw error;

 toast.success("Request denied");
 loadRequests();
 } catch (error: any) {
 console.error("Error denying request:", error);
 toast.error(error.message ||"Failed to deny request");
 } finally {
 setProcessingId(null);
 }
 };

 const handleMarkFulfilled = async (requestId: string) => {
 setProcessingId(requestId);
 try {
 const { error } = await supabase
 .from("prescription_refill_requests")
 .update({ status:"fulfilled" })
 .eq("id", requestId);

 if (error) throw error;

 toast.success("Marked as fulfilled");
 loadRequests();
 } catch (error: any) {
 console.error("Error marking fulfilled:", error);
 toast.error(error.message ||"Failed to update request");
 } finally {
 setProcessingId(null);
 }
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case"pending":
 return <Badge className="bg-warning"><Clock className="w-3 h-3 mr-1" aria-hidden="true" />Pending</Badge>;
 case"approved":
 return <Badge className="bg-info"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
 case"denied":
 return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Denied</Badge>;
 case"fulfilled":
 return <Badge className="bg-success"><Package className="w-3 h-3 mr-1" aria-hidden="true" />Fulfilled</Badge>;
 default:
 return <Badge variant="secondary">{status}</Badge>;
 }
 };

 const pendingRequests = requests.filter(r => r.status ==="pending");
 const approvedRequests = requests.filter(r => r.status ==="approved");
 const otherRequests = requests.filter(r => !["pending","approved"].includes(r.status));

 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-6 h-6 animate-spin" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-xl font-semibold flex items-center gap-2">
 <Pill className="w-5 h-5" />
 Prescription Refill Requests
 </h2>
 <p className="text-sm text-muted-foreground">
 Review and manage medication refill requests from pet owners
 </p>
 </div>

 {requests.length === 0 ? (
 <Card className="p-8 text-center text-muted-foreground">
 <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
 <p>No refill requests yet.</p>
 <p className="text-sm mt-1">Requests from pet owners will appear here.</p>
 </Card>
 ) : (
 <div className="space-y-6">
 {pendingRequests.length > 0 && (
 <div>
 <h3 className="font-medium mb-3 text-warning">Pending Review ({pendingRequests.length})</h3>
 <div className="grid gap-4">
 {pendingRequests.map((request) => (
 <Card key={request.id} className="p-4 border-warning/20 bg-warning/50">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium">{request.medication_name}</h4>
 {getStatusBadge(request.status)}
 </div>
 <p className="text-sm text-muted-foreground">
 Pet: {request.pet?.name} ({request.pet?.type}) • Owner: {request.owner?.full_name ||"Unknown"}
 </p>
 {request.current_dosage && (
 <p className="text-sm">Dosage: {request.current_dosage}</p>
 )}
 <p className="text-sm">Quantity: {request.quantity_requested}</p>
 {request.reason && (
 <p className="text-sm mt-1 italic">"{request.reason}"</p>
 )}
 <p className="text-xs text-muted-foreground mt-2">
 Requested: {format(parseISO(request.created_at),"MMM d, yyyy'at' h:mm a")}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Button
 size="sm"
 onClick={() => {
 setSelectedRequest(request);
 setIsApproveDialogOpen(true);
 }}
 disabled={processingId === request.id}
 >
 <Check className="w-4 h-4 mr-1" />
 Approve
 </Button>
 <Button
 size="sm"
 variant="destructive"
 onClick={() => handleDeny(request.id)}
 disabled={processingId === request.id}
 >
 {processingId === request.id ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <X className="w-4 h-4" />
 )}
 </Button>
 </div>
 </div>
 </Card>
 ))}
 </div>
 </div>
 )}

 {approvedRequests.length > 0 && (
 <div>
 <h3 className="font-medium mb-3 text-info">Approved - Awaiting Fulfillment ({approvedRequests.length})</h3>
 <div className="grid gap-4">
 {approvedRequests.map((request) => (
 <Card key={request.id} className="p-4 border-info/20 bg-info/50">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium">{request.medication_name}</h4>
 {getStatusBadge(request.status)}
 </div>
 <p className="text-sm text-muted-foreground">
 Pet: {request.pet?.name} • Owner: {request.owner?.full_name ||"Unknown"}
 </p>
 <p className="text-sm">Quantity: {request.quantity_requested}</p>
 {request.fulfillment_type && (
 <p className="text-sm">
 Fulfillment: {FULFILLMENT_OPTIONS.find(o => o.value === request.fulfillment_type)?.label}
 </p>
 )}
 {request.vet_notes && (
 <p className="text-sm mt-1">Notes: {request.vet_notes}</p>
 )}
 </div>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleMarkFulfilled(request.id)}
 disabled={processingId === request.id}
 >
 {processingId === request.id ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <>
 <Package className="w-4 h-4 mr-1" aria-hidden="true" />
 Mark Fulfilled
 </>
 )}
 </Button>
 </div>
 </Card>
 ))}
 </div>
 </div>
 )}

 {otherRequests.length > 0 && (
 <div>
 <h3 className="font-medium mb-3 text-muted-foreground">History ({otherRequests.length})</h3>
 <div className="grid gap-4">
 {otherRequests.map((request) => (
 <Card key={request.id} className="p-4 opacity-75">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium">{request.medication_name}</h4>
 {getStatusBadge(request.status)}
 </div>
 <p className="text-sm text-muted-foreground">
 Pet: {request.pet?.name} • Owner: {request.owner?.full_name ||"Unknown"}
 </p>
 <p className="text-xs text-muted-foreground">
 {format(parseISO(request.created_at),"MMM d, yyyy")}
 </p>
 </div>
 </div>
 </Card>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Approval Dialog */}
 <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Approve Prescription Refill</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-4">
 {selectedRequest && (
 <div className="p-3 bg-muted rounded-lg">
 <p className="font-medium">{selectedRequest.medication_name}</p>
 <p className="text-sm text-muted-foreground">
 For: {selectedRequest.pet?.name} • Quantity: {selectedRequest.quantity_requested}
 </p>
 </div>
 )}

 <div className="space-y-2">
 <Label>Fulfillment Method</Label>
 <Select
 value={approvalData.fulfillment_type}
 onValueChange={(v) => setApprovalData({ ...approvalData, fulfillment_type: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {FULFILLMENT_OPTIONS.map((opt) => (
 <SelectItem key={opt.value} value={opt.value}>
 {opt.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Vet Notes (optional)</Label>
 <Textarea
 value={approvalData.vet_notes}
 onChange={(e) => setApprovalData({ ...approvalData, vet_notes: e.target.value })}
 placeholder="Any notes for this prescription..."
 rows={2}
 />
 </div>

 <div className="space-y-2">
 <Label>Fulfillment Instructions (optional)</Label>
 <Textarea
 value={approvalData.fulfillment_notes}
 onChange={(e) => setApprovalData({ ...approvalData, fulfillment_notes: e.target.value })}
 placeholder="e.g., Ready for pickup after 2pm..."
 rows={2}
 />
 </div>
 </div>
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
 Cancel
 </Button>
 <Button onClick={handleApprove} disabled={processingId !== null}>
 {processingId && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 Approve Refill
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
};
