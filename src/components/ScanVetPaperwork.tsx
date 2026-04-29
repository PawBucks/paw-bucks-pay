import { useState, useRef } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
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
import { Card } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import {
 Camera,
 Loader2,
 Sparkles,
 Check,
 X,
 Trash2,
 Plus,
 ImageIcon,
 AlertCircle,
} from"lucide-react";
import { toast } from"sonner";

type ScanVetPaperworkProps = {
 petId: string;
 petName: string;
 petType?: string;
 petBreed?: string;
 onSuccess?: () => void;
};

type ExtractedLineItem = {
 id: string;
 title: string;
 record_type: string;
 quantity: number;
 price: number | null;
 description: string;
 included: boolean;
};

type ExtractedData = {
 visit_date: string | null;
 vet_name: string | null;
 doctor_name: string | null;
 visit_notes: string | null;
 line_items: ExtractedLineItem[];
 confidence: string;
};

const recordTypes = [
 { value:"vaccination", label:"Vaccination" },
 { value:"checkup", label:"Check-up" },
 { value:"surgery", label:"Surgery" },
 { value:"lab_results", label:"Lab Results" },
 { value:"prescription", label:"Prescription" },
 { value:"dental", label:"Dental" },
 { value:"emergency", label:"Emergency" },
 { value:"other", label:"Other" },
];

export const ScanVetPaperwork = ({
 petId,
 petName,
 petType,
 petBreed,
 onSuccess,
}: ScanVetPaperworkProps) => {
 const [open, setOpen] = useState(false);
 const [step, setStep] = useState<"upload" |"review" |"saving">("upload");
 const [isScanning, setIsScanning] = useState(false);
 const [isSaving, setIsSaving] = useState(false);
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const [imageFile, setImageFile] = useState<File | null>(null);
 const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const cameraInputRef = useRef<HTMLInputElement>(null);

 const resetState = () => {
 setStep("upload");
 setIsScanning(false);
 setIsSaving(false);
 setPreviewUrl(null);
 setImageFile(null);
 setExtractedData(null);
 };

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 if (!file.type.startsWith("image/")) {
 toast.error("Please select an image file");
 return;
 }

 if (file.size > 10 * 1024 * 1024) {
 toast.error("Image must be under 10MB");
 return;
 }

 setImageFile(file);
 setPreviewUrl(URL.createObjectURL(file));
 };

 const scanDocument = async () => {
 if (!imageFile) return;
 setIsScanning(true);

 try {
 // Convert to base64
 const reader = new FileReader();
 const base64Promise = new Promise<string>((resolve) => {
 reader.onload = () => {
 const base64 = (reader.result as string).split(",")[1];
 resolve(base64);
 };
 });
 reader.readAsDataURL(imageFile);
 const imageBase64 = await base64Promise;

 const { data, error } = await supabase.functions.invoke("scan-vet-paperwork", {
 body: { imageBase64, petName, petType, petBreed },
 });

 if (error) throw error;
 if (!data?.success) throw new Error(data?.error ||"Scan failed");

 const result = data.data;
 setExtractedData({
 visit_date: result.visit_date || new Date().toISOString().split("T")[0],
 vet_name: result.vet_name ||"",
 doctor_name: result.doctor_name ||"",
 visit_notes: result.visit_notes ||"",
 line_items: (result.line_items || []).map((item: any) => ({
 id: crypto.randomUUID(),
 title: item.title ||"",
 record_type: item.record_type ||"other",
 quantity: item.quantity || 1,
 price: item.price ?? null,
 description: item.description ||"",
 included: true,
 })),
 confidence: result.confidence ||"medium",
 });
 setStep("review");
 toast.success(`Found ${result.line_items?.length || 0} items!`);
 } catch (err) {
 console.error("Scan error:", err);
 toast.error("Failed to scan document. Please try again or enter manually.");
 } finally {
 setIsScanning(false);
 }
 };

 const updateLineItem = (id: string, field: string, value: any) => {
 if (!extractedData) return;
 setExtractedData({
 ...extractedData,
 line_items: extractedData.line_items.map((item) =>
 item.id === id ? { ...item, [field]: value } : item
 ),
 });
 };

 const addLineItem = () => {
 if (!extractedData) return;
 setExtractedData({
 ...extractedData,
 line_items: [
 ...extractedData.line_items,
 {
 id: crypto.randomUUID(),
 title:"",
 record_type:"other",
 quantity: 1,
 price: null,
 description:"",
 included: true,
 },
 ],
 });
 };

 const removeLineItem = (id: string) => {
 if (!extractedData) return;
 setExtractedData({
 ...extractedData,
 line_items: extractedData.line_items.filter((item) => item.id !== id),
 });
 };

 const handleSave = async () => {
 if (!extractedData) return;

 const includedItems = extractedData.line_items.filter((i) => i.included);
 if (includedItems.length === 0) {
 toast.error("Please include at least one item");
 return;
 }

 const invalidItems = includedItems.filter((i) => !i.title || !i.record_type);
 if (invalidItems.length > 0) {
 toast.error("Please fill in title and type for all included items");
 return;
 }

 setIsSaving(true);
 setStep("saving");

 try {
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) throw new Error("No user found");

 // Create the visit
 const { data: visit, error: visitError } = await supabase
 .from("pet_medical_visits")
 .insert({
 pet_id: petId,
 user_id: user.id,
 visit_date: extractedData.visit_date || new Date().toISOString().split("T")[0],
 notes: extractedData.visit_notes || null,
 vet_name: extractedData.vet_name || null,
 doctor_name: extractedData.doctor_name || null,
 })
 .select()
 .single();

 if (visitError) throw visitError;

 // Upload the scanned image as a file
 let scanFileUrl: string | null = null;
 if (imageFile) {
 const fileExt = imageFile.name.split(".").pop();
 const filePath = `${user.id}/${petId}/${crypto.randomUUID()}.${fileExt}`;
 const { error: uploadError } = await supabase.storage
 .from("medical-records")
 .upload(filePath, imageFile);

 if (!uploadError) {
 const {
 data: { publicUrl },
 } = supabase.storage.from("medical-records").getPublicUrl(filePath);
 scanFileUrl = publicUrl;
 }
 }

 // Insert each included line item
 for (const item of includedItems) {
 const { error: recordError } = await supabase
 .from("pet_medical_records")
 .insert({
 visit_id: visit.id,
 pet_id: petId,
 user_id: user.id,
 record_type: item.record_type,
 title: item.title,
 record_date: extractedData.visit_date || new Date().toISOString().split("T")[0],
 quantity: item.quantity || null,
 price: item.price,
 description: item.description || null,
 file_url: scanFileUrl,
 } as any);

 if (recordError) throw recordError;
 }

 toast.success(`${includedItems.length} medical records saved!`);
 setOpen(false);
 resetState();
 onSuccess?.();
 } catch (err) {
 console.error("Save error:", err);
 toast.error("Failed to save records");
 setStep("review");
 } finally {
 setIsSaving(false);
 }
 };

 const confidenceColor =
 extractedData?.confidence ==="high"
 ?"text-success"
 : extractedData?.confidence ==="medium"
 ?"text-warning"
 :"text-destructive";

 return (
 <Dialog
 open={open}
 onOpenChange={(o) => {
 setOpen(o);
 if (!o) resetState();
 }}
 >
 <DialogTrigger asChild>
 <Button variant="outline">
 <Camera className="w-4 h-4 mr-2" />
 Scan Paperwork
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
 {step ==="upload" && (
 <>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Sparkles className="w-5 h-5 text-primary" />
 Scan Vet Paperwork
 </DialogTitle>
 <DialogDescription>
 Take a photo or upload an image of your vet paperwork. We'll
 automatically extract all the medical information.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4">
 {previewUrl ? (
 <div className="relative">
 <img
 src={previewUrl}
 alt="Scanned document"
 className="w-full max-h-[400px] object-contain rounded-lg border"
 />
 <Button
 variant="destructive"
 size="sm"
 className="absolute top-2 right-2"
 onClick={() => {
 setPreviewUrl(null);
 setImageFile(null);
 }}
 >
 <X className="w-4 h-4" />
 </Button>
 </div>
 ) : (
 <div className="grid grid-cols-2 gap-4">
 <Card
 className="p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors border-dashed border-2"
 onClick={() => cameraInputRef.current?.click()}
 >
 <Camera className="w-10 h-10 text-primary" />
 <span className="text-sm font-medium">Take Photo</span>
 <span className="text-xs text-muted-foreground text-center">
 Use your camera to capture the document
 </span>
 </Card>
 <Card
 className="p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors border-dashed border-2"
 onClick={() => fileInputRef.current?.click()}
 >
 <ImageIcon className="w-10 h-10 text-primary" />
 <span className="text-sm font-medium">Upload Image</span>
 <span className="text-xs text-muted-foreground text-center">
 Select a photo from your device
 </span>
 </Card>
 </div>
 )}

 <input
 ref={cameraInputRef}
 type="file"
 accept="image/*"
 capture="environment"
 onChange={handleFileSelect}
 className="hidden"
 />
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handleFileSelect}
 className="hidden"
 />
 </div>

 <DialogFooter>
 <Button variant="outline" onClick={() => setOpen(false)}>
 Cancel
 </Button>
 <Button onClick={scanDocument} disabled={!imageFile || isScanning}>
 {isScanning ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Scanning...
 </>
 ) : (
 <>
 <Sparkles className="w-4 h-4 mr-2" />
 Scan Document
 </>
 )}
 </Button>
 </DialogFooter>
 </>
 )}

 {step ==="review" && extractedData && (
 <>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Check className="w-5 h-5 text-success" />
 Review Extracted Records
 </DialogTitle>
 <DialogDescription className="flex items-center gap-2">
 Review and edit the information below before saving.
 <Badge variant="outline" className={confidenceColor}>
 {extractedData.confidence} confidence
 </Badge>
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-6 py-4">
 {/* Visit Info */}
 <div className="space-y-4 pb-4 border-b">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Visit Date</Label>
 <Input
 type="date"
 value={extractedData.visit_date ||""}
 onChange={(e) =>
 setExtractedData({ ...extractedData, visit_date: e.target.value })
 }
 />
 </div>
 <div className="space-y-2">
 <Label>Vet Clinic</Label>
 <Input
 value={extractedData.vet_name ||""}
 onChange={(e) =>
 setExtractedData({ ...extractedData, vet_name: e.target.value })
 }
 placeholder="Clinic name"
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Doctor</Label>
 <Input
 value={extractedData.doctor_name ||""}
 onChange={(e) =>
 setExtractedData({ ...extractedData, doctor_name: e.target.value })
 }
 placeholder="Doctor's name"
 />
 </div>
 <div className="space-y-2">
 <Label>Visit Notes</Label>
 <Input
 value={extractedData.visit_notes ||""}
 onChange={(e) =>
 setExtractedData({ ...extractedData, visit_notes: e.target.value })
 }
 placeholder="General notes"
 />
 </div>
 </div>
 </div>

 {/* Line Items */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <Label className="text-base">
 Extracted Items ({extractedData.line_items.filter((i) => i.included).length} selected)
 </Label>
 <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
 <Plus className="w-4 h-4 mr-1" />
 Add Item
 </Button>
 </div>

 {extractedData.line_items.map((item, index) => (
 <Card
 key={item.id}
 className={`p-4 space-y-3 transition-opacity ${
 !item.included ?"opacity-50" :""
 }`}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 checked={item.included}
 onChange={(e) =>
 updateLineItem(item.id,"included", e.target.checked)
 }
 className="w-4 h-4"
 />
 <span className="text-sm font-medium text-muted-foreground">
 Item {index + 1}
 </span>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => removeLineItem(item.id)}
 >
 <Trash2 className="w-4 h-4 text-destructive" />
 </Button>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1">
 <Label className="text-xs">Title</Label>
 <Input
 value={item.title}
 onChange={(e) => updateLineItem(item.id,"title", e.target.value)}
 placeholder="e.g., Rabies Vaccine"
 className="h-9"
 />
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Type</Label>
 <Select
 value={item.record_type}
 onValueChange={(v) => updateLineItem(item.id,"record_type", v)}
 >
 <SelectTrigger className="h-9">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {recordTypes.map((t) => (
 <SelectItem key={t.value} value={t.value}>
 {t.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-3">
 <div className="space-y-1">
 <Label className="text-xs">Qty</Label>
 <Input
 type="number"
 min="1"
 value={item.quantity}
 onChange={(e) =>
 updateLineItem(item.id,"quantity", parseInt(e.target.value) || 1)
 }
 className="h-9"
 />
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Price ($)</Label>
 <Input
 type="number"
 step="0.01"
 min="0"
 value={item.price ??""}
 onChange={(e) =>
 updateLineItem(
 item.id,
"price",
 e.target.value ? parseFloat(e.target.value) : null
 )
 }
 placeholder="0.00"
 className="h-9"
 />
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Description</Label>
 <Input
 value={item.description}
 onChange={(e) =>
 updateLineItem(item.id,"description", e.target.value)
 }
 placeholder="Details..."
 className="h-9"
 />
 </div>
 </div>
 </Card>
 ))}
 </div>

 {extractedData.confidence ==="low" && (
 <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning">
 <AlertCircle className="w-4 h-4 flex-shrink-0" />
 <span>
 Low confidence scan — please double-check all fields against
 your paperwork.
 </span>
 </div>
 )}
 </div>

 <DialogFooter>
 <Button variant="outline" onClick={() => setStep("upload")}>
 Re-scan
 </Button>
 <Button onClick={handleSave} disabled={isSaving}>
 {isSaving ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Saving...
 </>
 ) : (
 <>
 <Check className="w-4 h-4 mr-2" />
 Save{""}
 {extractedData.line_items.filter((i) => i.included).length}{""}
 Records
 </>
 )}
 </Button>
 </DialogFooter>
 </>
 )}

 {step ==="saving" && (
 <div className="py-12 text-center space-y-4">
 <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
 <p className="text-muted-foreground">
 Saving medical records for {petName}...
 </p>
 </div>
 )}
 </DialogContent>
 </Dialog>
 );
};
