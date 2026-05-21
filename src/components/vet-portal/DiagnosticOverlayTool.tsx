import { useState, useCallback } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { ScrollArea } from"@/components/ui/scroll-area";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { AlertCircle, CheckCircle, Image, Loader2, Scan, ThumbsDown, ThumbsUp, Upload, Sparkles } from "lucide-react";

import { toast } from"sonner";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";

interface DiagnosticOverlayToolProps {
 vetId: string;
}

const analysisTypes = [
 { value:"xray", label:"X-Ray", icon:"" },
 { value:"ultrasound", label:"Ultrasound", icon:"" },
 { value:"ct", label:"CT Scan", icon:"" },
 { value:"mri", label:"MRI", icon:"" },
 { value:"ecg", label:"ECG/EKG", icon:"" },
 { value:"bloodwork", label:"Bloodwork", icon:"" },
];

const severityColors: Record<string, string> = {
 normal:"bg-success text-white",
 mild:"bg-warning text-black",
 moderate:"bg-warning text-white",
 severe:"bg-destructive text-white",
 critical:"bg-destructive text-white",
};

export const DiagnosticOverlayTool = ({ vetId }: DiagnosticOverlayToolProps) => {
 const [selectedPetId, setSelectedPetId] = useState<string>("");
 const [analysisType, setAnalysisType] = useState<string>("xray");
 const [bodyPart, setBodyPart] = useState("");
 const [clinicalContext, setClinicalContext] = useState("");
 const [imageUrls, setImageUrls] = useState<string[]>([]);
 const [uploading, setUploading] = useState(false);
 const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
 const [vetFeedback, setVetFeedback] = useState("");

 const queryClient = useQueryClient();

 // Fetch vet's patients
 const { data: patients } = useQuery({
 queryKey: ["vet-patients-diagnostics", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("pet_profiles")
 .select("id, name, type, breed, birthday")
 .order("name");

 if (error) throw error;
 return (data || []) as any[];
 },
 });

 // Fetch recent analyses
 const { data: recentAnalyses, refetch: refetchAnalyses } = useQuery({
 queryKey: ["diagnostic-analyses", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("diagnostic_ai_analyses")
 .select(`
 *,
 pet:pet_profiles(name, species)
 `)
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false })
 .limit(10);

 if (error) throw error;
 return data || [];
 },
 });

 // Handle image upload
 const handleImageUpload = useCallback(async (files: FileList) => {
 if (!selectedPetId) {
 toast.error("Please select a patient first");
 return;
 }

 setUploading(true);
 const uploadedUrls: string[] = [];

 try {
 for (const file of Array.from(files)) {
 const fileExt = file.name.split(".").pop();
 const fileName = `${selectedPetId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

 const { error: uploadError, data } = await supabase.storage
 .from("vet-imaging")
 .upload(fileName, file);

 if (uploadError) throw uploadError;

 const { data: urlData } = supabase.storage
 .from("vet-imaging")
 .getPublicUrl(fileName);

 uploadedUrls.push(urlData.publicUrl);
 }

 setImageUrls((prev) => [...prev, ...uploadedUrls]);
 toast.success(`${uploadedUrls.length} image(s) uploaded`);
 } catch (error: any) {
 console.error("Upload error:", error);
 toast.error("Failed to upload image(s)");
 } finally {
 setUploading(false);
 }
 }, [selectedPetId]);

 // Submit for AI analysis
 const analysisMutation = useMutation({
 mutationFn: async () => {
 if (!selectedPetId || imageUrls.length === 0) {
 throw new Error("Please select a patient and upload at least one image");
 }

 const pet = patients?.find((p) => p.id === selectedPetId);

 // Create analysis record
 const { data: analysis, error: createError } = await supabase
 .from("diagnostic_ai_analyses")
 .insert({
 pet_id: selectedPetId,
 vet_id: vetId,
 analysis_type: analysisType,
 image_urls: imageUrls,
 status:"pending",
 })
 .select()
 .single();

 if (createError) throw createError;

 // Trigger AI analysis
 const { data, error } = await supabase.functions.invoke("ai-diagnostic-overlay", {
 body: {
 analysis_id: analysis.id,
 image_urls: imageUrls,
 analysis_type: analysisType,
 pet_name: pet?.name,
 pet_species: pet?.type,
 pet_breed: pet?.breed,
 pet_age: pet?.birthday ? calculateAge(pet.birthday) : undefined,
 body_part: bodyPart,
 clinical_context: clinicalContext,
 },
 });

 if (error) throw error;
 return data;
 },
 onSuccess: () => {
 toast.success("AI analysis complete!");
 refetchAnalyses();
 // Reset form
 setImageUrls([]);
 setBodyPart("");
 setClinicalContext("");
 },
 onError: (error: any) => {
 toast.error(error.message ||"Failed to analyze image");
 },
 });

 // Submit vet review
 const reviewMutation = useMutation({
 mutationFn: async ({ analysisId, agrees, corrections }: { 
 analysisId: string; 
 agrees: boolean; 
 corrections: string;
 }) => {
 const { error } = await supabase
 .from("diagnostic_ai_analyses")
 .update({
 status: agrees ?"confirmed" :"disputed",
 vet_agrees: agrees,
 vet_corrections: corrections || null,
 reviewed_at: new Date().toISOString(),
 })
 .eq("id", analysisId);

 if (error) throw error;
 },
 onSuccess: () => {
 toast.success("Review saved");
 queryClient.invalidateQueries({ queryKey: ["diagnostic-analyses"] });
 setSelectedAnalysis(null);
 setVetFeedback("");
 },
 onError: (error: any) => {
 toast.error(error.message ||"Failed to save review");
 },
 });

 const calculateAge = (dateOfBirth: string): string => {
 const birth = new Date(dateOfBirth);
 const now = new Date();
 const years = Math.floor(
 (now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
 );
 return `${years} years`;
 };

 const selectedPet = patients?.find((p) => p.id === selectedPetId);

 return (
 <div className="space-y-6">
 {/* Upload Section */}
 <Card className="p-6">
 <div className="flex items-center gap-3 mb-6">
 <div className="w-10 h-10 rounded-full bg-info/10 /30 flex items-center justify-center">
 <Scan className="w-5 h-5 text-info" />
 </div>
 <div>
 <h3 className="text-lg font-semibold">Diagnostic AI Overlay</h3>
 <p className="text-sm text-muted-foreground">
 Upload imaging to get AI-assisted anomaly detection
 </p>
 </div>
 </div>

 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label>Patient</Label>
 <Select value={selectedPetId} onValueChange={setSelectedPetId}>
 <SelectTrigger>
 <SelectValue placeholder="Select patient..." />
 </SelectTrigger>
 <SelectContent>
 {patients?.map((pet) => (
 <SelectItem key={pet.id} value={pet.id}>
 {pet.name} ({pet.type})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label>Analysis Type</Label>
 <Select value={analysisType} onValueChange={setAnalysisType}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {analysisTypes.map((type) => (
 <SelectItem key={type.value} value={type.value}>
 {type.icon} {type.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label>Body Part/Region</Label>
 <Input
 value={bodyPart}
 onChange={(e) => setBodyPart(e.target.value)}
 placeholder="e.g., Thorax, Right forelimb"
 />
 </div>
 <div>
 <Label>Clinical Context</Label>
 <Input
 value={clinicalContext}
 onChange={(e) => setClinicalContext(e.target.value)}
 placeholder="e.g., Coughing for 3 days"
 />
 </div>
 </div>

 {/* Image Upload */}
 <div>
 <Label>Upload Images</Label>
 <div
 className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center ${
 uploading ?"bg-muted" :"hover:bg-muted"
 } transition-colors cursor-pointer`}
 onClick={() => document.getElementById("image-upload")?.click()}
 >
 <input
 id="image-upload"
 type="file"
 multiple
 accept="image/*,.dcm"
 className="hidden"
 onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
 disabled={uploading || !selectedPetId}
 />
 {uploading ? (
 <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
 ) : (
 <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
 )}
 <p className="mt-2 text-sm text-muted-foreground">
 {uploading
 ?"Uploading..."
 :"Click or drag images here (JPEG, PNG, DICOM)"}
 </p>
 </div>
 </div>

 {/* Preview uploaded images */}
 {imageUrls.length > 0 && (
 <div>
 <Label>Uploaded Images ({imageUrls.length})</Label>
 <div className="flex gap-2 mt-2 flex-wrap">
 {imageUrls.map((url, idx) => (
 <div key={idx} className="relative">
 <img
 src={url}
 alt={`Upload ${idx + 1}`}
 className="w-20 h-20 object-cover rounded-lg border"
 />
 <button
 className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full text-xs"
 onClick={() =>
 setImageUrls((prev) => prev.filter((_, i) => i !== idx))
 }
 >
 ×
 </button>
 </div>
 ))}
 </div>
 </div>
 )}

 <Button
 className="w-full"
 onClick={() => analysisMutation.mutate()}
 disabled={
 analysisMutation.isPending ||
 !selectedPetId ||
 imageUrls.length === 0
 }
 >
 {analysisMutation.isPending ? (
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 ) : (
 <Sparkles className="w-4 h-4 mr-2" />
 )}
 Analyze with AI
 </Button>
 </div>
 </Card>

 {/* Recent Analyses */}
 <Card className="p-6">
 <h3 className="text-lg font-semibold mb-4">Recent AI Analyses</h3>

 {recentAnalyses && recentAnalyses.length > 0 ? (
 <div className="space-y-3">
 {recentAnalyses.map((analysis: any) => (
 <div
 key={analysis.id}
 className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
 onClick={() => setSelectedAnalysis(analysis)}
 >
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3">
 <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
 {analysis.image_urls?.[0] ? (
 <img
 src={analysis.image_urls[0]}
 alt="Thumbnail"
 className="w-full h-full object-cover rounded-lg"
 />
 ) : (
 <Image className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
 )}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h4 className="font-medium">{analysis.pet?.name}</h4>
 <Badge variant="outline">
 {analysisTypes.find((t) => t.value === analysis.analysis_type)?.label || analysis.analysis_type}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground">
 {new Date(analysis.created_at).toLocaleString()}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {analysis.status ==="ready" && analysis.severity_assessment && (
 <Badge className={severityColors[analysis.severity_assessment]}>
 {analysis.severity_assessment}
 </Badge>
 )}
 {analysis.status ==="analyzing" && (
 <Badge variant="secondary">
 <Loader2 className="w-3 h-3 mr-1 animate-spin" />
 Analyzing
 </Badge>
 )}
 {analysis.status ==="confirmed" && (
 <Badge className="bg-success text-white">
 <CheckCircle className="w-3 h-3 mr-1" />
 Confirmed
 </Badge>
 )}
 {analysis.status ==="disputed" && (
 <Badge className="bg-warning text-white">
 <AlertCircle className="w-3 h-3 mr-1" />
 Disputed
 </Badge>
 )}
 </div>
 </div>

 {analysis.ai_summary && (
 <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
 {analysis.ai_summary}
 </p>
 )}

 {analysis.ai_anomalies_detected?.length > 0 && (
 <div className="mt-2 flex gap-1 flex-wrap">
 {analysis.ai_anomalies_detected.slice(0, 3).map((anomaly: any, idx: number) => (
 <Badge key={idx} variant="outline" className="text-xs">
 {anomaly.anomaly}
 </Badge>
 ))}
 {analysis.ai_anomalies_detected.length > 3 && (
 <Badge variant="outline" className="text-xs">
 +{analysis.ai_anomalies_detected.length - 3} more
 </Badge>
 )}
 </div>
 )}
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 <Scan className="w-12 h-12 mx-auto mb-2 opacity-50" />
 <p>No analyses yet</p>
 <p className="text-sm">Upload an image to get AI-assisted diagnosis</p>
 </div>
 )}
 </Card>

 {/* Analysis Detail Dialog */}
 <Dialog
 open={!!selectedAnalysis}
 onOpenChange={() => setSelectedAnalysis(null)}
 >
 <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-3">
 AI Diagnostic Analysis
 {selectedAnalysis?.severity_assessment && (
 <Badge className={severityColors[selectedAnalysis.severity_assessment]}>
 {selectedAnalysis.severity_assessment}
 </Badge>
 )}
 </DialogTitle>
 </DialogHeader>

 <ScrollArea className="flex-1 pr-4">
 {selectedAnalysis && (
 <div className="space-y-6">
 {/* Image Preview */}
 {selectedAnalysis.image_urls?.length > 0 && (
 <div>
 <Label>Images</Label>
 <div className="flex gap-2 mt-2 flex-wrap">
 {selectedAnalysis.image_urls.map((url: string, idx: number) => (
 <img
 key={idx}
 src={url}
 alt={`Image ${idx + 1}`}
 className="w-48 h-48 object-contain rounded-lg border bg-black"
 />
 ))}
 </div>
 </div>
 )}

 {/* AI Summary */}
 {selectedAnalysis.ai_summary && (
 <div>
 <Label>AI Summary</Label>
 <p className="mt-1 p-3 bg-muted rounded-lg">
 {selectedAnalysis.ai_summary}
 </p>
 </div>
 )}

 {/* Findings */}
 {selectedAnalysis.ai_findings?.length > 0 && (
 <div>
 <Label>Findings</Label>
 <div className="mt-2 space-y-2">
 {selectedAnalysis.ai_findings.map((finding: any, idx: number) => (
 <div key={idx} className="p-3 border rounded-lg">
 <div className="flex items-center justify-between">
 <span className="font-medium">{finding.finding}</span>
 <Badge
 variant={
 finding.significance ==="severe"
 ?"destructive"
 : finding.significance ==="moderate"
 ?"default"
 :"secondary"
 }
 >
 {finding.significance}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground mt-1">
 Location: {finding.location} • Confidence:{""}
 {Math.round(finding.confidence * 100)}%
 </p>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Anomalies */}
 {selectedAnalysis.ai_anomalies_detected?.length > 0 && (
 <div>
 <Label className="flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-destructive" />
 Anomalies Detected
 </Label>
 <div className="mt-2 space-y-2">
 {selectedAnalysis.ai_anomalies_detected.map((anomaly: any, idx: number) => (
 <div
 key={idx}
 className="p-3 border-l-4 border-l-red-500 bg-destructive/10 /20 rounded-r-lg"
 >
 <div className="flex items-center justify-between">
 <span className="font-medium">{anomaly.anomaly}</span>
 <Badge className={severityColors[anomaly.severity]}>
 {anomaly.severity}
 </Badge>
 </div>
 {anomaly.differential_diagnoses?.length > 0 && (
 <p className="text-sm text-muted-foreground mt-1">
 Differentials: {anomaly.differential_diagnoses.join(",")}
 </p>
 )}
 <p className="text-xs text-muted-foreground">
 Confidence: {Math.round(anomaly.confidence * 100)}%
 </p>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Recommendations */}
 {selectedAnalysis.ai_recommendations && (
 <div>
 <Label>AI Recommendations</Label>
 <p className="mt-1 p-3 bg-info/10 /20 rounded-lg">
 {selectedAnalysis.ai_recommendations}
 </p>
 </div>
 )}

 {/* Vet Review Section */}
 {selectedAnalysis.status ==="ready" && (
 <div className="border-t pt-4">
 <Label>Your Review</Label>
 <Textarea
 value={vetFeedback}
 onChange={(e) => setVetFeedback(e.target.value)}
 placeholder="Add corrections or additional findings..."
 className="mt-2"
 rows={3}
 />
 <div className="flex gap-2 mt-4">
 <Button
 className="flex-1 bg-success hover:bg-success"
 onClick={() =>
 reviewMutation.mutate({
 analysisId: selectedAnalysis.id,
 agrees: true,
 corrections: vetFeedback,
 })
 }
 disabled={reviewMutation.isPending}
 >
 <ThumbsUp className="w-4 h-4 mr-2" aria-hidden="true" />
 Confirm Findings
 </Button>
 <Button
 className="flex-1"
 variant="outline"
 onClick={() =>
 reviewMutation.mutate({
 analysisId: selectedAnalysis.id,
 agrees: false,
 corrections: vetFeedback,
 })
 }
 disabled={reviewMutation.isPending}
 >
 <ThumbsDown className="w-4 h-4 mr-2" aria-hidden="true" />
 Dispute / Correct
 </Button>
 </div>
 </div>
 )}

 {/* Processing info */}
 <div className="text-xs text-muted-foreground flex items-center justify-between pt-4 border-t">
 <span>Model: {selectedAnalysis.model_used}</span>
 <span>
 Confidence: {Math.round((selectedAnalysis.ai_confidence_score || 0) * 100)}%
 </span>
 <span>Processed in {selectedAnalysis.processing_time_ms}ms</span>
 </div>
 </div>
 )}
 </ScrollArea>
 </DialogContent>
 </Dialog>
 </div>
 );
};
