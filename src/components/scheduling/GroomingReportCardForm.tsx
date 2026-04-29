import { useState, useRef } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Textarea } from"@/components/ui/textarea";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from"@/components/ui/dialog";
import { Camera, Send, Save, X, Plus, Loader2, FileText, ImageIcon } from"lucide-react";
import { toast } from"sonner";

interface GroomingReportCardFormProps {
 bookingId: string;
 merchantId: string;
 petId?: string | null;
 petName?: string | null;
 customerUserId: string;
 customerName?: string;
 serviceName?: string;
 onClose: () => void;
}

export function GroomingReportCardForm({
 bookingId,
 merchantId,
 petId,
 petName,
 customerUserId,
 customerName,
 serviceName,
 onClose,
}: GroomingReportCardFormProps) {
 const queryClient = useQueryClient();
 const fileInputRef = useRef<HTMLInputElement>(null);

 const [overallNotes, setOverallNotes] = useState("");
 const [behaviorNotes, setBehaviorNotes] = useState("");
 const [skinCoatNotes, setSkinCoatNotes] = useState("");
 const [recommendations, setRecommendations] = useState("");
 const [photos, setPhotos] = useState<{ file?: File; url?: string; caption: string; preview?: string }[]>([]);
 const [uploading, setUploading] = useState(false);

 // Load existing report if any
 const { data: existingReport, isLoading } = useQuery({
 queryKey: ["grooming-report", bookingId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("grooming_report_cards")
 .select("*, grooming_report_photos(*)")
 .eq("booking_id", bookingId)
 .maybeSingle();
 if (error) throw error;
 if (data) {
 setOverallNotes(data.overall_notes ||"");
 setBehaviorNotes(data.behavior_notes ||"");
 setSkinCoatNotes(data.skin_coat_notes ||"");
 setRecommendations(data.recommendations ||"");
 if ((data as any).grooming_report_photos?.length) {
 setPhotos((data as any).grooming_report_photos.map((p: any) => ({
 url: p.photo_url,
 caption: p.caption ||"",
 })));
 }
 }
 return data;
 },
 });

 const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files || []);
 const newPhotos = files.map((file) => ({
 file,
 caption:"",
 preview: URL.createObjectURL(file),
 }));
 setPhotos((prev) => [...prev, ...newPhotos]);
 if (fileInputRef.current) fileInputRef.current.value ="";
 };

 const removePhoto = (index: number) => {
 setPhotos((prev) => {
 const removed = prev[index];
 if (removed.preview) URL.revokeObjectURL(removed.preview);
 return prev.filter((_, i) => i !== index);
 });
 };

 const uploadPhotos = async (reportId: string): Promise<{ url: string; caption: string }[]> => {
 const uploaded: { url: string; caption: string }[] = [];
 for (const photo of photos) {
 if (photo.url && !photo.file) {
 // Already uploaded
 uploaded.push({ url: photo.url, caption: photo.caption });
 continue;
 }
 if (!photo.file) continue;

 const ext = photo.file.name.split(".").pop();
 const path = `${merchantId}/${reportId}/${crypto.randomUUID()}.${ext}`;
 const { error } = await supabase.storage.from("grooming-reports").upload(path, photo.file);
 if (error) {
 console.error("Photo upload error:", error);
 continue;
 }
 uploaded.push({ url: path, caption: photo.caption });
 }
 return uploaded;
 };

 const saveMutation = useMutation({
 mutationFn: async (sendToCustomer: boolean) => {
 setUploading(true);

 const reportData = {
 booking_id: bookingId,
 merchant_id: merchantId,
 pet_id: petId || null,
 pet_name: petName || null,
 customer_user_id: customerUserId,
 overall_notes: overallNotes || null,
 behavior_notes: behaviorNotes || null,
 skin_coat_notes: skinCoatNotes || null,
 recommendations: recommendations || null,
 status: sendToCustomer ?"sent" :"draft",
 sent_at: sendToCustomer ? new Date().toISOString() : null,
 };

 let reportId: string;

 if (existingReport) {
 const { error } = await supabase
 .from("grooming_report_cards")
 .update(reportData)
 .eq("id", existingReport.id);
 if (error) throw error;
 reportId = existingReport.id;

 // Delete old photos
 await supabase.from("grooming_report_photos").delete().eq("report_id", reportId);
 } else {
 const { data, error } = await supabase
 .from("grooming_report_cards")
 .insert(reportData)
 .select("id")
 .single();
 if (error) throw error;
 reportId = data.id;
 }

 // Upload and insert photos
 const uploadedPhotos = await uploadPhotos(reportId);
 if (uploadedPhotos.length > 0) {
 const { error: photoErr } = await supabase.from("grooming_report_photos").insert(
 uploadedPhotos.map((p, i) => ({
 report_id: reportId,
 photo_url: p.url,
 caption: p.caption || null,
 display_order: i,
 }))
 );
 if (photoErr) console.error("Photo insert error:", photoErr);
 }

 // Send notification to customer if sending
 if (sendToCustomer) {
 await supabase.from("notifications").insert({
 user_id: customerUserId,
 title: `📋 Grooming Report Card for ${petName ||"your pet"}`,
 message: `Your grooming report from ${serviceName ||"today's service"} is ready! Check out the photos and notes.`,
 category:"transactional",
 link_url:"/my-bookings",
 });
 }

 return { sent: sendToCustomer };
 },
 onSuccess: ({ sent }) => {
 toast.success(sent ?"Report card sent to customer!" :"Draft saved!");
 queryClient.invalidateQueries({ queryKey: ["grooming-report", bookingId] });
 if (sent) onClose();
 },
 onError: (err) => {
 console.error("Save error:", err);
 toast.error("Failed to save report card");
 },
 onSettled: () => setUploading(false),
 });

 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="font-semibold text-lg flex items-center gap-2">
 <FileText className="w-5 h-5 text-primary" />
 Grooming Report Card
 </h3>
 <p className="text-sm text-muted-foreground">
 {petName ? `For ${petName}` :""}{customerName ? ` • ${customerName}` :""}
 </p>
 </div>
 {existingReport?.status ==="sent" && (
 <Badge className="bg-success/10 text-success border-success/20">Sent</Badge>
 )}
 </div>

 {/* Photo Upload */}
 <div>
 <Label className="mb-2 block">Photos</Label>
 <div className="grid grid-cols-3 gap-2">
 {photos.map((photo, i) => (
 <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
 <img
 src={photo.preview || (photo.url ? (() => {
 const { data } = supabase.storage.from("grooming-reports").getPublicUrl(photo.url!);
 return data.publicUrl;
 })() :"")}
 alt={photo.caption || `Photo ${i + 1}`}
 className="w-full h-full object-cover"
 />
 <button
 onClick={() => removePhoto(i)}
 className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
 >
 <X className="w-3 h-3" />
 </button>
 <input
 type="text"
 placeholder="Caption..."
 value={photo.caption}
 onChange={(e) => {
 const updated = [...photos];
 updated[i] = { ...updated[i], caption: e.target.value };
 setPhotos(updated);
 }}
 className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 border-none outline-none"
 />
 </div>
 ))}
 <button
 onClick={() => fileInputRef.current?.click()}
 className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary transition-colors"
 >
 <Camera className="w-5 h-5 text-muted-foreground" />
 <span className="text-xs text-muted-foreground">Add Photo</span>
 </button>
 </div>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 multiple
 onChange={handleAddPhotos}
 className="hidden"
 />
 </div>

 {/* Notes */}
 <div className="space-y-4">
 <div>
 <Label htmlFor="overall">Overall Notes</Label>
 <Textarea
 id="overall"
 placeholder="How did the grooming go overall?"
 value={overallNotes}
 onChange={(e) => setOverallNotes(e.target.value)}
 rows={3}
 />
 </div>

 <div>
 <Label htmlFor="behavior">Behavior Notes</Label>
 <Textarea
 id="behavior"
 placeholder="How was the pet's behavior during the session?"
 value={behaviorNotes}
 onChange={(e) => setBehaviorNotes(e.target.value)}
 rows={2}
 />
 </div>

 <div>
 <Label htmlFor="skin">Skin & Coat Condition</Label>
 <Textarea
 id="skin"
 placeholder="Any observations about skin, coat, mats, or hot spots?"
 value={skinCoatNotes}
 onChange={(e) => setSkinCoatNotes(e.target.value)}
 rows={2}
 />
 </div>

 <div>
 <Label htmlFor="recs">Recommendations</Label>
 <Textarea
 id="recs"
 placeholder="Suggested next visit, products, or home care tips..."
 value={recommendations}
 onChange={(e) => setRecommendations(e.target.value)}
 rows={2}
 />
 </div>
 </div>

 {/* Actions */}
 <div className="flex gap-2 pt-4 border-t">
 <Button variant="outline" onClick={onClose} className="flex-1">
 Cancel
 </Button>
 <Button
 variant="secondary"
 onClick={() => saveMutation.mutate(false)}
 disabled={uploading || saveMutation.isPending}
 className="flex-1"
 >
 {saveMutation.isPending && !uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
 Save Draft
 </Button>
 <Button
 onClick={() => saveMutation.mutate(true)}
 disabled={uploading || saveMutation.isPending}
 className="flex-1"
 >
 {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
 Send to Owner
 </Button>
 </div>
 </div>
 );
}
