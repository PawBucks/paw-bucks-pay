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
import { ImageIcon, Plus, Loader2, ZoomIn, AlertTriangle } from"lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";
import type { ImagingRecord, ImagingType } from"./types";
import { PhotoLightbox } from"@/components/PhotoLightbox";

interface ImagingTabProps {
 petId: string;
 vetId: string;
}

const imagingTypes: { value: ImagingType; label: string }[] = [
 { value:"xray", label:"X-Ray (Radiograph)" },
 { value:"ultrasound", label:"Ultrasound" },
 { value:"mri", label:"MRI" },
 { value:"ct_scan", label:"CT Scan" },
 { value:"endoscopy", label:"Endoscopy" },
 { value:"other", label:"Other" },
];

export const ImagingTab = ({ petId, vetId }: ImagingTabProps) => {
 const [records, setRecords] = useState<ImagingRecord[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
 const [lightboxOpen, setLightboxOpen] = useState(false);
 const [lightboxImages, setLightboxImages] = useState<string[]>([]);
 const [lightboxIndex, setLightboxIndex] = useState(0);
 const [formData, setFormData] = useState({
 imaging_date: new Date().toISOString().split("T")[0],
 imaging_type:"xray" as ImagingType,
 body_region:"",
 views:"",
 indication:"",
 findings:"",
 interpretation:"",
 radiologist_notes:"",
 is_abnormal: false,
 follow_up_recommended: false,
 });

 useEffect(() => {
 loadRecords();
 }, [petId]);

 const loadRecords = async () => {
 try {
 const { data, error } = await supabase
 .from("pet_imaging_records")
 .select("*")
 .eq("pet_id", petId)
 .order("imaging_date", { ascending: false });

 if (error) throw error;
 setRecords((data as ImagingRecord[]) || []);
 } catch (error) {
 console.error("Error loading imaging records:", error);
 } finally {
 setIsLoading(false);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.body_region || !formData.indication) {
 toast.error("Please fill in required fields");
 return;
 }

 setIsSubmitting(true);
 try {
 const imageUrls: string[] = [];

 // Upload images
 for (const file of selectedFiles) {
 const fileExt = file.name.split(".").pop();
 const fileName = `${petId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

 const { error: uploadError } = await supabase.storage
 .from("vet-imaging")
 .upload(fileName, file);

 if (uploadError) throw uploadError;

 const { data: { publicUrl } } = supabase.storage
 .from("vet-imaging")
 .getPublicUrl(fileName);

 imageUrls.push(publicUrl);
 }

 const { error } = await supabase.from("pet_imaging_records").insert({
 pet_id: petId,
 vet_id: vetId,
 imaging_date: formData.imaging_date,
 imaging_type: formData.imaging_type,
 body_region: formData.body_region,
 views: formData.views ? formData.views.split(",").map((s) => s.trim()) : null,
 indication: formData.indication,
 findings: formData.findings || null,
 interpretation: formData.interpretation || null,
 radiologist_notes: formData.radiologist_notes || null,
 image_urls: imageUrls,
 thumbnail_url: imageUrls[0] || null,
 is_abnormal: formData.is_abnormal,
 follow_up_recommended: formData.follow_up_recommended,
 });

 if (error) throw error;
 toast.success("Imaging record saved");
 setDialogOpen(false);
 loadRecords();
 setSelectedFiles([]);
 setFormData({
 imaging_date: new Date().toISOString().split("T")[0],
 imaging_type:"xray",
 body_region:"",
 views:"",
 indication:"",
 findings:"",
 interpretation:"",
 radiologist_notes:"",
 is_abnormal: false,
 follow_up_recommended: false,
 });
 } catch (error: any) {
 console.error("Error saving imaging record:", error);
 toast.error(error.message ||"Failed to save imaging record");
 } finally {
 setIsSubmitting(false);
 }
 };

 const openLightbox = (images: string[], startIndex: number = 0) => {
 setLightboxImages(images);
 setLightboxIndex(startIndex);
 setLightboxOpen(true);
 };

 if (isLoading) {
 return <div className="text-center py-8 text-muted-foreground">Loading imaging records...</div>;
 }

 return (
 <div className="space-y-4">
 <div className="flex justify-end">
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="w-4 h-4 mr-2" />
 Add Imaging
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Add Imaging Record</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="imaging_type">Imaging Type *</Label>
 <Select
 value={formData.imaging_type}
 onValueChange={(value) => setFormData({ ...formData, imaging_type: value as ImagingType })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {imagingTypes.map((type) => (
 <SelectItem key={type.value} value={type.value}>
 {type.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label htmlFor="imaging_date">Date *</Label>
 <Input
 id="imaging_date"
 type="date"
 value={formData.imaging_date}
 onChange={(e) => setFormData({ ...formData, imaging_date: e.target.value })}
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="body_region">Body Region *</Label>
 <Input
 id="body_region"
 value={formData.body_region}
 onChange={(e) => setFormData({ ...formData, body_region: e.target.value })}
 placeholder="e.g., Thorax, Abdomen, Right forelimb"
 />
 </div>
 <div>
 <Label htmlFor="views">Views</Label>
 <Input
 id="views"
 value={formData.views}
 onChange={(e) => setFormData({ ...formData, views: e.target.value })}
 placeholder="Comma-separated (e.g., Lateral, VD)"
 />
 </div>
 </div>
 <div>
 <Label htmlFor="indication">Indication / Reason *</Label>
 <Input
 id="indication"
 value={formData.indication}
 onChange={(e) => setFormData({ ...formData, indication: e.target.value })}
 placeholder="e.g., Coughing, Suspected fracture, Mass evaluation"
 />
 </div>
 <div>
 <Label htmlFor="findings">Findings</Label>
 <Textarea
 id="findings"
 value={formData.findings}
 onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
 placeholder="Describe the imaging findings..."
 rows={3}
 />
 </div>
 <div>
 <Label htmlFor="interpretation">Interpretation</Label>
 <Textarea
 id="interpretation"
 value={formData.interpretation}
 onChange={(e) => setFormData({ ...formData, interpretation: e.target.value })}
 placeholder="Clinical interpretation of findings..."
 rows={2}
 />
 </div>
 <div>
 <Label htmlFor="radiologist_notes">Radiologist Notes</Label>
 <Textarea
 id="radiologist_notes"
 value={formData.radiologist_notes}
 onChange={(e) => setFormData({ ...formData, radiologist_notes: e.target.value })}
 placeholder="Notes from radiologist review if applicable..."
 rows={2}
 />
 </div>
 <div>
 <Label htmlFor="images">Upload Images</Label>
 <Input
 id="images"
 type="file"
 accept="image/*"
 multiple
 onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
 />
 {selectedFiles.length > 0 && (
 <p className="text-sm text-muted-foreground mt-1">
 {selectedFiles.length} file(s) selected
 </p>
 )}
 </div>
 <div className="flex gap-4">
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="is_abnormal"
 checked={formData.is_abnormal}
 onChange={(e) => setFormData({ ...formData, is_abnormal: e.target.checked })}
 className="rounded"
 />
 <Label htmlFor="is_abnormal">Abnormal Findings</Label>
 </div>
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="follow_up"
 checked={formData.follow_up_recommended}
 onChange={(e) => setFormData({ ...formData, follow_up_recommended: e.target.checked })}
 className="rounded"
 />
 <Label htmlFor="follow_up">Follow-up Recommended</Label>
 </div>
 </div>
 <div className="flex gap-2 justify-end">
 <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={isSubmitting}>
 {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 Save
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 </div>

 {records.length === 0 ? (
 <Card className="p-8 text-center text-muted-foreground">
 <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
 <p>No imaging records yet.</p>
 </Card>
 ) : (
 <div className="grid gap-4 md:grid-cols-2">
 {records.map((record) => (
 <Card key={record.id} className="overflow-hidden">
 <div className="p-4">
 <div className="flex items-start justify-between mb-3">
 <div>
 <div className="flex items-center gap-2">
 <h3 className="font-semibold capitalize">
 {imagingTypes.find((t) => t.value === record.imaging_type)?.label || record.imaging_type}
 </h3>
 {record.is_abnormal && (
 <Badge variant="destructive" className="flex items-center gap-1">
 <AlertTriangle className="w-3 h-3" />
 Abnormal
 </Badge>
 )}
 </div>
 <p className="text-sm text-muted-foreground">
 {record.body_region} • {format(new Date(record.imaging_date),"MMM d, yyyy")}
 </p>
 </div>
 {record.follow_up_recommended && (
 <Badge variant="outline">Follow-up</Badge>
 )}
 </div>

 {/* Image Thumbnails */}
 {record.image_urls.length > 0 && (
 <div className="flex gap-2 mb-3 overflow-x-auto">
 {record.image_urls.slice(0, 4).map((url, idx) => (
 <div
 key={idx}
 className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer group"
 onClick={() => openLightbox(record.image_urls, idx)}
 >
 <img
 src={url}
 alt={`${record.imaging_type} image ${idx + 1}`}
 className="w-full h-full object-cover"
 />
 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
 <ZoomIn className="w-5 h-5 text-white" />
 </div>
 {idx === 3 && record.image_urls.length > 4 && (
 <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
 <span className="text-white font-semibold">
 +{record.image_urls.length - 4}
 </span>
 </div>
 )}
 </div>
 ))}
 </div>
 )}

 <div className="text-sm space-y-2">
 <p>
 <strong>Indication:</strong> {record.indication}
 </p>
 {record.findings && (
 <p>
 <strong>Findings:</strong> {record.findings}
 </p>
 )}
 {record.interpretation && (
 <p>
 <strong>Interpretation:</strong> {record.interpretation}
 </p>
 )}
 </div>
 </div>
 </Card>
 ))}
 </div>
 )}

 <PhotoLightbox
 photos={lightboxImages}
 initialIndex={lightboxIndex}
 open={lightboxOpen}
 onOpenChange={setLightboxOpen}
 />
 </div>
 );
};
