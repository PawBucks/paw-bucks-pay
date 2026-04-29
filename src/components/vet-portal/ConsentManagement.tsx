import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from"@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { FileSignature, Plus, Loader2, Send, CheckCircle, Clock, XCircle } from"lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";
import type { ConsentRequest, ConsentStatus } from"./types";

interface ConsentManagementProps {
 vetId: string;
}

export const ConsentManagement = ({ vetId }: ConsentManagementProps) => {
 const [requests, setRequests] = useState<ConsentRequest[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [patients, setPatients] = useState<any[]>([]);
 const [formData, setFormData] = useState({
 pet_id:"",
 owner_id:"",
 consent_type:"surgery",
 title:"",
 description:"",
 procedure_details:"",
 risks_disclosed:"",
 estimated_cost:"",
 cost_range_min:"",
 cost_range_max:"",
 });

 useEffect(() => {
 loadRequests();
 loadPatients();
 }, [vetId]);

 const loadRequests = async () => {
 try {
 const { data, error } = await supabase
 .from("pet_consent_requests")
 .select(`
 *,
 pet_profiles:pet_id (name, type),
 profiles:owner_id (full_name, email)
 `)
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false });

 if (error) throw error;
 setRequests((data as ConsentRequest[]) || []);
 } catch (error) {
 console.error("Error loading consent requests:", error);
 } finally {
 setIsLoading(false);
 }
 };

 const loadPatients = async () => {
 try {
 const { data } = await supabase
 .from("vet_messages")
 .select(`
 pet_id,
 user_id,
 pet_profiles:pet_id (id, name),
 profiles:user_id (id, full_name)
 `)
 .eq("vet_id", vetId)
 .not("pet_id","is", null);

 const unique = new Map();
 data?.forEach((msg: any) => {
 if (msg.pet_profiles && msg.profiles) {
 unique.set(msg.pet_id, {
 pet_id: msg.pet_id,
 pet_name: msg.pet_profiles.name,
 owner_id: msg.user_id,
 owner_name: msg.profiles.full_name,
 });
 }
 });
 setPatients(Array.from(unique.values()));
 } catch (error) {
 console.error("Error loading patients:", error);
 }
 };

 const handlePatientChange = (petId: string) => {
 const patient = patients.find((p) => p.pet_id === petId);
 setFormData({
 ...formData,
 pet_id: petId,
 owner_id: patient?.owner_id ||"",
 });
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.pet_id || !formData.title || !formData.description) {
 toast.error("Please fill in required fields");
 return;
 }

 setIsSubmitting(true);
 try {
 const { error } = await supabase.from("pet_consent_requests").insert({
 pet_id: formData.pet_id,
 vet_id: vetId,
 owner_id: formData.owner_id,
 consent_type: formData.consent_type,
 title: formData.title,
 description: formData.description,
 procedure_details: formData.procedure_details || null,
 risks_disclosed: formData.risks_disclosed || null,
 estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
 cost_range_min: formData.cost_range_min ? parseFloat(formData.cost_range_min) : null,
 cost_range_max: formData.cost_range_max ? parseFloat(formData.cost_range_max) : null,
 });

 if (error) throw error;
 toast.success("Consent request sent to pet owner");
 setDialogOpen(false);
 loadRequests();
 setFormData({
 pet_id:"",
 owner_id:"",
 consent_type:"surgery",
 title:"",
 description:"",
 procedure_details:"",
 risks_disclosed:"",
 estimated_cost:"",
 cost_range_min:"",
 cost_range_max:"",
 });
 } catch (error: any) {
 console.error("Error creating consent request:", error);
 toast.error(error.message ||"Failed to send consent request");
 } finally {
 setIsSubmitting(false);
 }
 };

 const getStatusIcon = (status: ConsentStatus) => {
 switch (status) {
 case"signed":
 return <CheckCircle className="w-4 h-4 text-success" />;
 case"declined":
 return <XCircle className="w-4 h-4 text-destructive" />;
 case"expired":
 return <Clock className="w-4 h-4 text-muted-foreground" />;
 default:
 return <Clock className="w-4 h-4 text-warning" />;
 }
 };

 if (isLoading) {
 return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
 }

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold">Digital Consent Forms</h3>
 <p className="text-sm text-muted-foreground">
 Send consent forms for owners to sign remotely
 </p>
 </div>
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="w-4 h-4 mr-2" />
 New Consent Request
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>Create Consent Request</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <Label>Patient *</Label>
 <Select value={formData.pet_id} onValueChange={handlePatientChange}>
 <SelectTrigger>
 <SelectValue placeholder="Select patient" />
 </SelectTrigger>
 <SelectContent>
 {patients.map((p) => (
 <SelectItem key={p.pet_id} value={p.pet_id}>
 {p.pet_name} ({p.owner_name})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Consent Type</Label>
 <Select
 value={formData.consent_type}
 onValueChange={(v) => setFormData({ ...formData, consent_type: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="surgery">Surgery</SelectItem>
 <SelectItem value="anesthesia">Anesthesia</SelectItem>
 <SelectItem value="treatment">Treatment</SelectItem>
 <SelectItem value="estimate">Cost Estimate</SelectItem>
 <SelectItem value="euthanasia">Euthanasia</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Title *</Label>
 <Input
 value={formData.title}
 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
 placeholder="e.g., Spay Surgery Consent"
 />
 </div>
 <div>
 <Label>Description *</Label>
 <Textarea
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 placeholder="Explain what the owner is consenting to..."
 rows={3}
 />
 </div>
 <div>
 <Label>Risks Disclosed</Label>
 <Textarea
 value={formData.risks_disclosed}
 onChange={(e) => setFormData({ ...formData, risks_disclosed: e.target.value })}
 placeholder="List potential risks..."
 rows={2}
 />
 </div>
 <div className="grid grid-cols-3 gap-2">
 <div>
 <Label>Est. Cost ($)</Label>
 <Input
 type="number"
 value={formData.estimated_cost}
 onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
 />
 </div>
 <div>
 <Label>Min ($)</Label>
 <Input
 type="number"
 value={formData.cost_range_min}
 onChange={(e) => setFormData({ ...formData, cost_range_min: e.target.value })}
 />
 </div>
 <div>
 <Label>Max ($)</Label>
 <Input
 type="number"
 value={formData.cost_range_max}
 onChange={(e) => setFormData({ ...formData, cost_range_max: e.target.value })}
 />
 </div>
 </div>
 <div className="flex gap-2 justify-end">
 <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={isSubmitting}>
 {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
 Send Request
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 </div>

 {requests.length === 0 ? (
 <Card className="p-8 text-center text-muted-foreground">
 <FileSignature className="w-12 h-12 mx-auto mb-2 opacity-50" />
 <p>No consent requests yet.</p>
 </Card>
 ) : (
 <div className="space-y-3">
 {requests.map((req) => (
 <Card key={req.id} className="p-4">
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3">
 {getStatusIcon(req.status)}
 <div>
 <h4 className="font-semibold">{req.title}</h4>
 <p className="text-sm text-muted-foreground">
 {req.pet_profiles?.name} • {req.profiles?.full_name}
 </p>
 <p className="text-xs text-muted-foreground">
 Sent {format(new Date(req.created_at),"MMM d, yyyy")}
 {req.signed_at && ` • Signed ${format(new Date(req.signed_at),"MMM d, yyyy")}`}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Badge variant="outline" className="capitalize">{req.consent_type}</Badge>
 <Badge variant={req.status ==="signed" ?"default" : req.status ==="pending" ?"secondary" :"destructive"} className="capitalize">
 {req.status}
 </Badge>
 </div>
 </div>
 </Card>
 ))}
 </div>
 )}
 </div>
 );
};
