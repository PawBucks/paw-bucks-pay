import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from"@/components/ui/dialog";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import { toast } from"sonner";

type Patient = {
 pet_id: string;
 user_id: string;
 pet_name: string;
 pet_type: string;
 owner_name: string;
};

type VetPatientsListProps = {
 vetId: string;
};

const recordTypes = [
 { value:"vaccination", label:"Vaccination" },
 { value:"checkup", label:"Checkup" },
 { value:"surgery", label:"Surgery" },
 { value:"lab_results", label:"Lab Results" },
 { value:"prescription", label:"Prescription" },
 { value:"dental", label:"Dental" },
 { value:"emergency", label:"Emergency" },
 { value:"other", label:"Other" },
];

export const VetPatientsList = ({ vetId }: VetPatientsListProps) => {
 const [patients, setPatients] = useState<Patient[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [selectedPet, setSelectedPet] = useState<Patient | null>(null);
 const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
 const [isUploading, setIsUploading] = useState(false);
 const [file, setFile] = useState<File | null>(null);
 const [recordType, setRecordType] = useState("checkup");

 useEffect(() => {
 loadPatients();
 }, [vetId]);

 const loadPatients = async () => {
 try {
 // Get unique patients from messages
 const { data: messages, error } = await supabase
 .from("vet_messages")
 .select(`
 pet_id,
 user_id,
 pet_profiles:pet_id (
 id,
 name,
 type
 ),
 profiles:user_id (
 full_name
 )
 `)
 .eq("vet_id", vetId)
 .not("pet_id","is", null);

 if (error) throw error;

 // Deduplicate and format patients
 const uniquePatients = new Map<string, Patient>();
 messages?.forEach((msg: any) => {
 if (msg.pet_profiles && msg.profiles) {
 uniquePatients.set(msg.pet_id, {
 pet_id: msg.pet_id,
 user_id: msg.user_id,
 pet_name: msg.pet_profiles.name,
 pet_type: msg.pet_profiles.type,
 owner_name: msg.profiles.full_name,
 });
 }
 });

 setPatients(Array.from(uniquePatients.values()));
 } catch (error) {
 console.error("Error loading patients:", error);
 toast.error("Failed to load patients");
 } finally {
 setIsLoading(false);
 }
 };

 const handleUploadRecord = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 if (!selectedPet) return;

 setIsUploading(true);
 try {
 const formData = new FormData(e.currentTarget);
 const title = formData.get("title") as string;
 const description = formData.get("description") as string;
 const recordDate = formData.get("recordDate") as string;

 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error("Not authenticated");

 let fileUrl = null;

 // Upload file if provided
 if (file) {
 const fileExt = file.name.split(".").pop();
 const fileName = `${selectedPet.user_id}/${selectedPet.pet_id}/${Date.now()}.${fileExt}`;
 
 const { error: uploadError } = await supabase.storage
 .from("medical-records")
 .upload(fileName, file);

 if (uploadError) throw uploadError;

 const { data: { publicUrl } } = supabase.storage
 .from("medical-records")
 .getPublicUrl(fileName);
 
 fileUrl = publicUrl;
 }

 // Insert medical record
 const { error: insertError } = await supabase
 .from("pet_medical_records")
 .insert({
 pet_id: selectedPet.pet_id,
 user_id: selectedPet.user_id,
 vet_id: vetId,
 record_type: recordType as any,
 title,
 description: description || null,
 record_date: recordDate,
 file_url: fileUrl,
 });

 if (insertError) throw insertError;

 toast.success("Medical record uploaded successfully");
 setUploadDialogOpen(false);
 setFile(null);
 setRecordType("checkup");
 setSelectedPet(null);
 } catch (error: any) {
 console.error("Error uploading record:", error);
 toast.error(error.message ||"Failed to upload medical record");
 } finally {
 setIsUploading(false);
 }
 };

 if (isLoading) {
 return <div className="text-center py-8 text-muted-foreground">Loading patients...</div>;
 }

 if (patients.length === 0) {
 return (
 <Card className="p-8 text-center text-muted-foreground">
 <span className="w-12 h-12 mx-auto mb-2 opacity-50" aria-hidden="true">🐾</span>
 <p>No patients yet. Patients will appear here once they message you.</p>
 </Card>
 );
 }

 return (
 <>
 <div className="grid gap-4 md:grid-cols-2">
 {patients.map((patient) => (
 <Card key={patient.pet_id} className="p-4">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <h3 className="font-semibold text-lg">{patient.pet_name}</h3>
 <p className="text-sm text-muted-foreground capitalize">
 {patient.pet_type}
 </p>
 <p className="text-sm text-muted-foreground mt-1">
 Owner: {patient.owner_name}
 </p>
 </div>
 <Button
 size="sm"
 onClick={() => {
 setSelectedPet(patient);
 setUploadDialogOpen(true);
 }}
 >
 <Upload className="w-4 h-4 mr-2" />
 Upload Record
 </Button>
 </div>
 </Card>
 ))}
 </div>

 <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>
 Upload Medical Record for {selectedPet?.pet_name}
 </DialogTitle>
 </DialogHeader>
 <form onSubmit={handleUploadRecord} className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="title">Title *</Label>
 <Input
 id="title"
 name="title"
 placeholder="e.g., Annual Vaccination"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="recordType">Record Type *</Label>
 <Select value={recordType} onValueChange={setRecordType} required>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {recordTypes.map((type) => (
 <SelectItem key={type.value} value={type.value}>
 {type.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label htmlFor="recordDate">Date *</Label>
 <Input
 id="recordDate"
 name="recordDate"
 type="date"
 required
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="description">Description</Label>
 <Textarea
 id="description"
 name="description"
 placeholder="Additional notes..."
 rows={3}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="file">Attach File (PDF, Image)</Label>
 <Input
 id="file"
 type="file"
 accept=".pdf,.jpg,.jpeg,.png"
 onChange={(e) => setFile(e.target.files?.[0] || null)}
 />
 {file && (
 <p className="text-sm text-muted-foreground">{file.name}</p>
 )}
 </div>

 <div className="flex gap-2 justify-end">
 <Button
 type="button"
 variant="outline"
 onClick={() => setUploadDialogOpen(false)}
 disabled={isUploading}
 >
 Cancel
 </Button>
 <Button type="submit" disabled={isUploading}>
 {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 Upload
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 </>
 );
};
