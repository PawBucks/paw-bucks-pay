import { useEffect, useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Download, Trash2, ChevronDown, ChevronRight, Pencil, Plus } from"lucide-react";
import { format } from"date-fns";
import { toast } from"sonner";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table";
import { Card } from"@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from"@/components/ui/collapsible";

import { Formatters } from "@/utils/formatters";
type RecordType ="vaccination" |"checkup" |"surgery" |"lab_results" |"prescription" |"dental" |"emergency" |"other";

type MedicalRecord = {
 id: string;
 visit_id: string | null;
 record_type: RecordType;
 title: string;
 description: string | null;
 record_date: string;
 file_url: string | null;
 quantity: number | null;
 price: number | null;
 created_at: string;
};

type Visit = {
 id: string;
 visit_date: string;
 notes: string | null;
 vet_name: string | null;
 doctor_name: string | null;
 records: MedicalRecord[];
};

type MedicalRecordsListProps = {
 petId: string;
 refreshTrigger?: number;
};

const recordTypeColors: Record<string, string> = {
 vaccination:"bg-success/10 text-success border-success/20",
 checkup:"bg-info/10 text-info border-info/20",
 surgery:"bg-destructive/10 text-destructive border-destructive/20",
 lab_results:"bg-accent/10 text-accent border-accent/20",
 prescription:"bg-warning/10 text-warning border-warning/20",
 dental:"bg-info/10 text-info border-info/20",
 emergency:"bg-accent/10 text-accent border-accent/20",
 other:"bg-muted/10 text-foreground border-border0/20",
};

export const MedicalRecordsList = ({ petId, refreshTrigger }: MedicalRecordsListProps) => {
 const [visits, setVisits] = useState<Visit[]>([]);
 const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());
 const [isLoading, setIsLoading] = useState(true);
 const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
 const [addingToVisitId, setAddingToVisitId] = useState<string | null>(null);
 const [editForm, setEditForm] = useState<{
 title: string;
 record_type: RecordType |"";
 description: string;
 quantity: string;
 price: string;
 }>({
 title:"",
 record_type:"",
 description:"",
 quantity:"",
 price:"",
 });
 const [newRecordForm, setNewRecordForm] = useState<{
 title: string;
 record_type: RecordType |"";
 description: string;
 quantity: string;
 price: string;
 file: File | null;
 }>({
 title:"",
 record_type:"",
 description:"",
 quantity:"",
 price:"",
 file: null,
 });

 const loadRecords = async () => {
 try {
 // Load all visits
 const { data: visitsData, error: visitsError } = await supabase
 .from("pet_medical_visits")
 .select("id, visit_date, notes, vet_name, doctor_name")
 .eq("pet_id", petId)
 .order("visit_date", { ascending: false });

 if (visitsError) throw visitsError;

 // Load all records
 const { data: recordsData, error: recordsError } = await supabase
 .from("pet_medical_records")
 .select("*")
 .eq("pet_id", petId)
 .order("created_at", { ascending: true });

 if (recordsError) throw recordsError;

 // Group records by visit
 const groupedVisits: Visit[] = (visitsData || []).map(visit => ({
 id: visit.id,
 visit_date: visit.visit_date,
 notes: visit.notes,
 vet_name: visit.vet_name,
 doctor_name: visit.doctor_name,
 records: (recordsData || []).filter(r => r.visit_id === visit.id),
 }));

 setVisits(groupedVisits);
 } catch (error) {
 console.error("Error loading medical records:", error);
 toast.error("Failed to load medical records");
 } finally {
 setIsLoading(false);
 }
 };

 useEffect(() => {
 loadRecords();
 }, [petId, refreshTrigger]);

 const toggleVisit = (visitId: string) => {
 setExpandedVisits(prev => {
 const newSet = new Set(prev);
 if (newSet.has(visitId)) {
 newSet.delete(visitId);
 } else {
 newSet.add(visitId);
 }
 return newSet;
 });
 };

 const handleDeleteVisit = async (visitId: string) => {
 if (!confirm("Are you sure you want to delete this entire visit and all its records?")) return;

 try {
 // Get all records for this visit to delete their files
 const { data: records } = await supabase
 .from("pet_medical_records")
 .select("file_url")
 .eq("visit_id", visitId);

 // Delete files from storage
 if (records) {
 const filesToDelete = records
 .filter(r => r.file_url)
 .map(r => r.file_url!.split("/medical-records/")[1])
 .filter(Boolean);

 if (filesToDelete.length > 0) {
 await supabase.storage.from("medical-records").remove(filesToDelete);
 }
 }

 // Delete visit (cascade will delete records)
 const { error } = await supabase
 .from("pet_medical_visits")
 .delete()
 .eq("id", visitId);

 if (error) throw error;

 toast.success("Visit and all records deleted");
 loadRecords();
 } catch (error) {
 console.error("Error deleting visit:", error);
 toast.error("Failed to delete visit");
 }
 };

 const handleDeleteRecord = async (recordId: string, fileUrl: string | null) => {
 if (!confirm("Are you sure you want to delete this record?")) return;

 try {
 // Delete file from storage if exists
 if (fileUrl) {
 const filePath = fileUrl.split("/medical-records/")[1];
 if (filePath) {
 await supabase.storage.from("medical-records").remove([filePath]);
 }
 }

 // Delete record from database
 const { error } = await supabase
 .from("pet_medical_records")
 .delete()
 .eq("id", recordId);

 if (error) throw error;

 toast.success("Record deleted");
 loadRecords();
 } catch (error) {
 console.error("Error deleting record:", error);
 toast.error("Failed to delete record");
 }
 };

 const handleDownload = (fileUrl: string, title: string) => {
 window.open(fileUrl,"_blank");
 };

 const handleEditRecord = (record: MedicalRecord) => {
 setEditingRecord(record);
 setEditForm({
 title: record.title,
 record_type: record.record_type,
 description: record.description ||"",
 quantity: record.quantity?.toString() ||"",
 price: record.price?.toString() ||"",
 });
 };

 const handleSaveEdit = async () => {
 if (!editingRecord || !editForm.record_type) return;

 try {
 const { error } = await supabase
 .from("pet_medical_records")
 .update({
 title: editForm.title,
 record_type: editForm.record_type as RecordType,
 description: editForm.description || null,
 quantity: editForm.quantity ? parseInt(editForm.quantity) : null,
 price: editForm.price ? parseFloat(editForm.price) : null,
 })
 .eq("id", editingRecord.id);

 if (error) throw error;

 toast.success("Record updated successfully");
 setEditingRecord(null);
 loadRecords();
 } catch (error) {
 console.error("Error updating record:", error);
 toast.error("Failed to update record");
 }
 };

 const handleAddNewRecord = async () => {
 if (!addingToVisitId || !newRecordForm.record_type || !newRecordForm.title) {
 toast.error("Please fill in required fields");
 return;
 }

 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error("Not authenticated");

 const visit = visits.find(v => v.id === addingToVisitId);
 if (!visit) throw new Error("Visit not found");

 let fileUrl = null;
 if (newRecordForm.file) {
 const fileExt = newRecordForm.file.name.split('.').pop();
 const fileName = `${user.id}/${Date.now()}.${fileExt}`;
 
 const { error: uploadError } = await supabase.storage
 .from('medical-records')
 .upload(fileName, newRecordForm.file);

 if (uploadError) throw uploadError;

 const { data: { publicUrl } } = supabase.storage
 .from('medical-records')
 .getPublicUrl(fileName);
 
 fileUrl = publicUrl;
 }

 const { error } = await supabase
 .from("pet_medical_records")
 .insert({
 pet_id: petId,
 user_id: user.id,
 visit_id: addingToVisitId,
 title: newRecordForm.title,
 record_type: newRecordForm.record_type as RecordType,
 description: newRecordForm.description || null,
 quantity: newRecordForm.quantity ? parseInt(newRecordForm.quantity) : null,
 price: newRecordForm.price ? parseFloat(newRecordForm.price) : null,
 record_date: visit.visit_date,
 file_url: fileUrl,
 });

 if (error) throw error;

 toast.success("Record added successfully");
 setAddingToVisitId(null);
 setNewRecordForm({
 title:"",
 record_type:"",
 description:"",
 quantity:"",
 price:"",
 file: null,
 });
 loadRecords();
 } catch (error) {
 console.error("Error adding record:", error);
 toast.error("Failed to add record");
 }
 };

 if (isLoading) {
 return <div className="text-center py-8 text-muted-foreground">Loading records...</div>;
 }

 if (visits.length === 0) {
 return (
 <div className="text-center py-8 text-muted-foreground">
 No medical visits yet. Add a visit to track your pet's health records.
 </div>
 );
 }

 const calculateVisitTotal = (records: MedicalRecord[]) => {
 return records.reduce((sum, record) => sum + (Number(record.price) || 0), 0);
 };

 const calculateMonthlyTotals = () => {
 const monthlyMap = new Map<string, { total: number; date: Date }>();
 visits.forEach(visit => {
 const visitDate = new Date(visit.visit_date);
 const monthKey = format(visitDate,"yyyy-MM");
 const visitTotal = calculateVisitTotal(visit.records);
 const existing = monthlyMap.get(monthKey);
 
 if (!existing) {
 monthlyMap.set(monthKey, { total: visitTotal, date: visitDate });
 } else {
 existing.total += visitTotal;
 }
 });
 return monthlyMap;
 };

 const calculateAnnualTotal = () => {
 return visits.reduce((sum, visit) => sum + calculateVisitTotal(visit.records), 0);
 };

 const monthlyTotals = calculateMonthlyTotals();
 const annualTotal = calculateAnnualTotal();

 return (
 <div className="space-y-4">
 <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
 <h3 className="font-semibold text-lg mb-4">Spending Summary</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <div className="text-sm text-muted-foreground mb-2">Annual Total</div>
 <div className="text-3xl font-bold text-primary">{Formatters.currency(annualTotal)}</div>
 </div>
 <div>
 <div className="text-sm text-muted-foreground mb-2">Monthly Breakdown</div>
 <div className="space-y-1">
 {Array.from(monthlyTotals.entries())
 .sort(([a], [b]) => b.localeCompare(a))
 .slice(0, 3)
 .map(([month, { total, date }]) => (
 <div key={month} className="flex justify-between text-sm">
 <span>{format(date,"MMMM yyyy")}</span>
 <span className="font-semibold">{Formatters.currency(total)}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </Card>
 {visits.map((visit) => {
 const isExpanded = expandedVisits.has(visit.id);
 const totalCost = calculateVisitTotal(visit.records);

 return (
 <Card key={visit.id} className="overflow-hidden">
 <Collapsible open={isExpanded} onOpenChange={() => toggleVisit(visit.id)}>
 <CollapsibleTrigger className="w-full">
 <div className="flex items-center justify-between p-4 hover:bg-accent transition-colors">
 <div className="flex items-center gap-3">
 {isExpanded ? (
 <ChevronDown className="w-5 h-5 text-muted-foreground" />
 ) : (
 <ChevronRight className="w-5 h-5 text-muted-foreground" />
 )}
 <div className="text-left">
 <div className="font-semibold">
 {format(new Date(visit.visit_date),"MMMM d, yyyy")}
 </div>
 <div className="text-sm text-muted-foreground">
 {visit.records.length} item{visit.records.length !== 1 ?'s' :''}
 {totalCost > 0 && ` • Total: ${Formatters.currency(totalCost)}`}
 </div>
 {(visit.vet_name || visit.doctor_name) && (
 <div className="text-sm text-muted-foreground mt-1">
 {visit.vet_name && <span>{visit.vet_name}</span>}
 {visit.vet_name && visit.doctor_name && <span> • </span>}
 {visit.doctor_name && <span>{visit.doctor_name}</span>}
 </div>
 )}
 {visit.notes && (
 <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
 {visit.notes}
 </div>
 )}
 </div>
 </div>
 <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
 <Button
 variant="outline"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 setAddingToVisitId(visit.id);
 }}
 >
 <Plus className="w-4 h-4 mr-1" />
 Add Item
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteVisit(visit.id);
 }}
 >
 <Trash2 className="w-4 h-4 text-destructive" />
 </Button>
 </div>
 </div>
 </CollapsibleTrigger>

 <CollapsibleContent>
 <div className="border-t">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Title</TableHead>
 <TableHead>Type</TableHead>
 <TableHead className="text-right">Qty</TableHead>
 <TableHead className="text-right">Price</TableHead>
 <TableHead>Description</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {visit.records.map((record) => (
 <TableRow key={record.id}>
 <TableCell className="font-medium">{record.title}</TableCell>
 <TableCell>
 <Badge variant="outline" className={recordTypeColors[record.record_type]}>
 {record.record_type.replace(/_/g, " ")}
 </Badge>
 </TableCell>
 <TableCell className="text-right">{record.quantity ||"-"}</TableCell>
 <TableCell className="text-right">
 {record.price ? `${Formatters.currency(Number(record.price))}` :"-"}
 </TableCell>
 <TableCell className="max-w-xs truncate">
 {record.description ||"-"}
 </TableCell>
 <TableCell className="text-right">
 <div className="flex gap-2 justify-end">
 {record.file_url && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleDownload(record.file_url!, record.title)}
 >
 <Download className="w-4 h-4" />
 </Button>
 )}
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleEditRecord(record)}
 >
 <Pencil className="w-4 h-4" />
 </Button>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => handleDeleteRecord(record.id, record.file_url)}
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </CollapsibleContent>
 </Collapsible>
 </Card>
 );
 })}

 <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Edit Medical Record</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <div>
 <Label htmlFor="edit-title">Title</Label>
 <Input
 id="edit-title"
 value={editForm.title}
 onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
 />
 </div>
 <div>
 <Label htmlFor="edit-type">Record Type</Label>
 <Select
 value={editForm.record_type}
 onValueChange={(value) => setEditForm({ ...editForm, record_type: value as RecordType })}
 >
 <SelectTrigger id="edit-type">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="vaccination">Vaccination</SelectItem>
 <SelectItem value="checkup">Checkup</SelectItem>
 <SelectItem value="surgery">Surgery</SelectItem>
 <SelectItem value="lab_results">Lab Results</SelectItem>
 <SelectItem value="prescription">Prescription</SelectItem>
 <SelectItem value="dental">Dental</SelectItem>
 <SelectItem value="emergency">Emergency</SelectItem>
 <SelectItem value="other">Other</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="edit-description">Description</Label>
 <Textarea
 id="edit-description"
 value={editForm.description}
 onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="edit-quantity">Quantity</Label>
 <Input
 id="edit-quantity"
 type="number"
 value={editForm.quantity}
 onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
 />
 </div>
 <div>
 <Label htmlFor="edit-price">Price ($)</Label>
 <Input
 id="edit-price"
 type="number"
 step="0.01"
 value={editForm.price}
 onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
 />
 </div>
 </div>
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => setEditingRecord(null)}>
 Cancel
 </Button>
 <Button onClick={handleSaveEdit}>
 Save Changes
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>

 <Dialog open={!!addingToVisitId} onOpenChange={() => setAddingToVisitId(null)}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Add New Item to Visit</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <div>
 <Label htmlFor="new-title">Title *</Label>
 <Input
 id="new-title"
 value={newRecordForm.title}
 onChange={(e) => setNewRecordForm({ ...newRecordForm, title: e.target.value })}
 required
 />
 </div>
 <div>
 <Label htmlFor="new-type">Record Type *</Label>
 <Select
 value={newRecordForm.record_type}
 onValueChange={(value) => setNewRecordForm({ ...newRecordForm, record_type: value as RecordType })}
 >
 <SelectTrigger id="new-type">
 <SelectValue placeholder="Select type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="vaccination">Vaccination</SelectItem>
 <SelectItem value="checkup">Checkup</SelectItem>
 <SelectItem value="surgery">Surgery</SelectItem>
 <SelectItem value="lab_results">Lab Results</SelectItem>
 <SelectItem value="prescription">Prescription</SelectItem>
 <SelectItem value="dental">Dental</SelectItem>
 <SelectItem value="emergency">Emergency</SelectItem>
 <SelectItem value="other">Other</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="new-description">Description</Label>
 <Textarea
 id="new-description"
 value={newRecordForm.description}
 onChange={(e) => setNewRecordForm({ ...newRecordForm, description: e.target.value })}
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="new-quantity">Quantity</Label>
 <Input
 id="new-quantity"
 type="number"
 value={newRecordForm.quantity}
 onChange={(e) => setNewRecordForm({ ...newRecordForm, quantity: e.target.value })}
 />
 </div>
 <div>
 <Label htmlFor="new-price">Price ($)</Label>
 <Input
 id="new-price"
 type="number"
 step="0.01"
 value={newRecordForm.price}
 onChange={(e) => setNewRecordForm({ ...newRecordForm, price: e.target.value })}
 />
 </div>
 </div>
 <div>
 <Label htmlFor="new-file">Attachment (optional)</Label>
 <Input
 id="new-file"
 type="file"
 onChange={(e) => setNewRecordForm({ ...newRecordForm, file: e.target.files?.[0] || null })}
 />
 </div>
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => setAddingToVisitId(null)}>
 Cancel
 </Button>
 <Button onClick={handleAddNewRecord}>
 Add Record
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
};
