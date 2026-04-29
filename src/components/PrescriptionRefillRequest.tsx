import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import { Label } from"@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from"@/components/ui/dialog";
import { Badge } from"@/components/ui/badge";
import { Pill, Plus, Loader2, Clock, Check, X, Package } from"lucide-react";
import { format, parseISO } from"date-fns";
import { toast } from"sonner";

type Pet = {
 id: string;
 name: string;
 type: string;
};

type Vet = {
 id: string;
 name: string;
 location: string;
};

type RefillRequest = {
 id: string;
 medication_name: string;
 current_dosage: string | null;
 quantity_requested: number;
 reason: string | null;
 status: string;
 vet_notes: string | null;
 fulfillment_type: string | null;
 fulfillment_notes: string | null;
 created_at: string;
 pet?: Pet;
 vet?: Vet;
};

export const PrescriptionRefillRequest = () => {
 const [requests, setRequests] = useState<RefillRequest[]>([]);
 const [pets, setPets] = useState<Pet[]>([]);
 const [vets, setVets] = useState<Vet[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isDialogOpen, setIsDialogOpen] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);

 const [formData, setFormData] = useState({
 pet_id:"",
 vet_id:"",
 medication_name:"",
 current_dosage:"",
 quantity_requested:"1",
 reason:"",
 });

 useEffect(() => {
 loadData();
 }, []);

 const loadData = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 // Load user's pets
 const { data: petsData } = await supabase
 .from("pet_profiles")
 .select("id, name, type")
 .eq("user_id", user.id);

 setPets(petsData || []);

 // Load partner vets
 const { data: vetsData } = await supabase
 .from("partner_vets_public")
 .select("id, name, location")
 .order("name");

 setVets(vetsData || []);

 // Load existing refill requests
 const { data: requestsData } = await supabase
 .from("prescription_refill_requests")
 .select(`
 *,
 pet:pet_profiles(id, name, type)
 `)
 .eq("user_id", user.id)
 .order("created_at", { ascending: false });

 // Get vet info
 const vetIds = [...new Set(requestsData?.map(r => r.vet_id) || [])];
 const { data: requestVetsData } = await supabase
 .from("partner_vets_public")
 .select("id, name, location")
 .in("id", vetIds);

 const vetMap = new Map(requestVetsData?.map(v => [v.id, v]));

 const enrichedRequests = requestsData?.map(r => ({
 ...r,
 vet: vetMap.get(r.vet_id),
 })) || [];

 setRequests(enrichedRequests);
 } catch (error) {
 console.error("Error loading data:", error);
 toast.error("Failed to load data");
 } finally {
 setIsLoading(false);
 }
 };

 const handleSubmit = async () => {
 if (!formData.pet_id || !formData.vet_id || !formData.medication_name) {
 toast.error("Please fill in all required fields");
 return;
 }

 setIsSubmitting(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error("Not authenticated");

 const { error } = await supabase.from("prescription_refill_requests").insert({
 pet_id: formData.pet_id,
 user_id: user.id,
 vet_id: formData.vet_id,
 medication_name: formData.medication_name,
 current_dosage: formData.current_dosage || null,
 quantity_requested: parseInt(formData.quantity_requested) || 1,
 reason: formData.reason || null,
 });

 if (error) throw error;

 toast.success("Refill request submitted successfully!");
 setIsDialogOpen(false);
 setFormData({
 pet_id:"",
 vet_id:"",
 medication_name:"",
 current_dosage:"",
 quantity_requested:"1",
 reason:"",
 });
 loadData();
 } catch (error: any) {
 console.error("Error submitting request:", error);
 toast.error(error.message ||"Failed to submit request");
 } finally {
 setIsSubmitting(false);
 }
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case"pending":
 return <Badge className="bg-warning/100"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
 case"approved":
 return <Badge className="bg-info/100"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
 case"denied":
 return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Denied</Badge>;
 case"fulfilled":
 return <Badge className="bg-success/100"><Package className="w-3 h-3 mr-1" />Fulfilled</Badge>;
 default:
 return <Badge variant="secondary">{status}</Badge>;
 }
 };

 const getFulfillmentLabel = (type: string | null) => {
 switch (type) {
 case"pawbucks_store": return"PawBucks Store";
 case"partner_pharmacy": return"Partner Pharmacy";
 case"in_clinic": return"In-Clinic Pickup";
 default: return type ||"";
 }
 };

 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-6 h-6 animate-spin" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-xl font-semibold flex items-center gap-2">
 <Pill className="w-5 h-5" />
 Prescription Refills
 </h2>
 <p className="text-sm text-muted-foreground">
 Request medication refills from your veterinarian
 </p>
 </div>
 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="w-4 h-4 mr-2" />
 Request Refill
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>Request Prescription Refill</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label>Pet *</Label>
 <Select value={formData.pet_id} onValueChange={(v) => setFormData({ ...formData, pet_id: v })}>
 <SelectTrigger>
 <SelectValue placeholder="Select your pet" />
 </SelectTrigger>
 <SelectContent>
 {pets.map((pet) => (
 <SelectItem key={pet.id} value={pet.id}>
 {pet.name} ({pet.type})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Veterinarian *</Label>
 <Select value={formData.vet_id} onValueChange={(v) => setFormData({ ...formData, vet_id: v })}>
 <SelectTrigger>
 <SelectValue placeholder="Select veterinarian" />
 </SelectTrigger>
 <SelectContent>
 {vets.map((vet) => (
 <SelectItem key={vet.id} value={vet.id}>
 {vet.name} - {vet.location}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Medication Name *</Label>
 <Input
 value={formData.medication_name}
 onChange={(e) => setFormData({ ...formData, medication_name: e.target.value })}
 placeholder="e.g., Apoquel, Heartgard, etc."
 />
 </div>

 <div className="space-y-2">
 <Label>Current Dosage</Label>
 <Input
 value={formData.current_dosage}
 onChange={(e) => setFormData({ ...formData, current_dosage: e.target.value })}
 placeholder="e.g., 16mg twice daily"
 />
 </div>

 <div className="space-y-2">
 <Label>Quantity</Label>
 <Select value={formData.quantity_requested} onValueChange={(v) => setFormData({ ...formData, quantity_requested: v })}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {[1, 2, 3, 6, 12].map((qty) => (
 <SelectItem key={qty} value={String(qty)}>
 {qty} {qty === 1 ?"month" :"months"} supply
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Additional Notes</Label>
 <Textarea
 value={formData.reason}
 onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
 placeholder="Any special requests or notes for your vet..."
 rows={2}
 />
 </div>
 </div>
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
 Cancel
 </Button>
 <Button onClick={handleSubmit} disabled={isSubmitting}>
 {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 Submit Request
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 {requests.length === 0 ? (
 <Card className="p-8 text-center text-muted-foreground">
 <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
 <p>No prescription refill requests yet.</p>
 <p className="text-sm mt-1">Request refills for your pet's medications with one tap.</p>
 </Card>
 ) : (
 <div className="grid gap-4">
 {requests.map((request) => (
 <Card key={request.id} className="p-4">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h3 className="font-medium">{request.medication_name}</h3>
 {getStatusBadge(request.status)}
 </div>
 <p className="text-sm text-muted-foreground">
 For: {request.pet?.name} • Vet: {request.vet?.name ||"Unknown"}
 </p>
 {request.current_dosage && (
 <p className="text-sm">Dosage: {request.current_dosage}</p>
 )}
 <p className="text-sm">Quantity: {request.quantity_requested} month(s) supply</p>
 
 {request.status ==="approved" && (
 <div className="mt-2 p-2 bg-info/10 rounded text-sm">
 <p className="font-medium text-info">
 ✓ Approved - {getFulfillmentLabel(request.fulfillment_type)}
 </p>
 {request.fulfillment_notes && (
 <p className="text-info mt-1">{request.fulfillment_notes}</p>
 )}
 </div>
 )}

 {request.status ==="denied" && request.vet_notes && (
 <div className="mt-2 p-2 bg-destructive/10 rounded text-sm">
 <p className="text-destructive">{request.vet_notes}</p>
 </div>
 )}

 <p className="text-xs text-muted-foreground mt-2">
 Requested: {format(parseISO(request.created_at),"MMM d, yyyy'at' h:mm a")}
 </p>
 </div>
 </div>
 </Card>
 ))}
 </div>
 )}
 </div>
 );
};
