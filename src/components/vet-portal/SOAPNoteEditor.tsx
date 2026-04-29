import { useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 ArrowLeft,
 Save,
 CheckCircle,
 FileText,
 Stethoscope,
 ClipboardList,
 Pill,
 Loader2,
} from"lucide-react";
import { toast } from"sonner";
import type { SOAPNote, SOAPNoteStatus } from"./types";

interface SOAPNoteEditorProps {
 petId: string;
 vetId: string;
 existingNote: SOAPNote | null;
 onSave: () => void;
 onCancel: () => void;
}

export const SOAPNoteEditor = ({
 petId,
 vetId,
 existingNote,
 onSave,
 onCancel,
}: SOAPNoteEditorProps) => {
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [formData, setFormData] = useState({
 // Subjective
 subjective_chief_complaint: existingNote?.subjective_chief_complaint ||"",
 subjective_history: existingNote?.subjective_history ||"",
 subjective_duration: existingNote?.subjective_duration ||"",
 subjective_owner_observations: existingNote?.subjective_owner_observations ||"",
 // Objective
 objective_temperature: existingNote?.objective_temperature?.toString() ||"",
 objective_weight: existingNote?.objective_weight?.toString() ||"",
 objective_heart_rate: existingNote?.objective_heart_rate?.toString() ||"",
 objective_respiratory_rate: existingNote?.objective_respiratory_rate?.toString() ||"",
 objective_body_condition_score: existingNote?.objective_body_condition_score?.toString() ||"",
 objective_physical_exam: existingNote?.objective_physical_exam ||"",
 objective_findings: existingNote?.objective_findings ||"",
 // Assessment
 assessment_primary_diagnosis: existingNote?.assessment_primary_diagnosis ||"",
 assessment_differential_diagnoses: existingNote?.assessment_differential_diagnoses?.join(",") ||"",
 assessment_prognosis: existingNote?.assessment_prognosis ||"",
 // Plan
 plan_treatment: existingNote?.plan_treatment ||"",
 plan_medications: existingNote?.plan_medications ||"",
 plan_follow_up: existingNote?.plan_follow_up ||"",
 plan_client_education: existingNote?.plan_client_education ||"",
 plan_referral: existingNote?.plan_referral ||"",
 });

 const handleChange = (field: string, value: string) => {
 setFormData((prev) => ({ ...prev, [field]: value }));
 };

 const handleSubmit = async (status: SOAPNoteStatus) => {
 if (!formData.subjective_chief_complaint || !formData.objective_physical_exam || 
 !formData.assessment_primary_diagnosis || !formData.plan_treatment) {
 toast.error("Please fill in all required fields");
 return;
 }

 setIsSubmitting(true);
 try {
 const noteData = {
 pet_id: petId,
 vet_id: vetId,
 subjective_chief_complaint: formData.subjective_chief_complaint,
 subjective_history: formData.subjective_history || null,
 subjective_duration: formData.subjective_duration || null,
 subjective_owner_observations: formData.subjective_owner_observations || null,
 objective_temperature: formData.objective_temperature ? parseFloat(formData.objective_temperature) : null,
 objective_weight: formData.objective_weight ? parseFloat(formData.objective_weight) : null,
 objective_heart_rate: formData.objective_heart_rate ? parseInt(formData.objective_heart_rate) : null,
 objective_respiratory_rate: formData.objective_respiratory_rate ? parseInt(formData.objective_respiratory_rate) : null,
 objective_body_condition_score: formData.objective_body_condition_score ? parseInt(formData.objective_body_condition_score) : null,
 objective_physical_exam: formData.objective_physical_exam,
 objective_findings: formData.objective_findings || null,
 assessment_primary_diagnosis: formData.assessment_primary_diagnosis,
 assessment_differential_diagnoses: formData.assessment_differential_diagnoses
 ? formData.assessment_differential_diagnoses.split(",").map((s) => s.trim()).filter(Boolean)
 : null,
 assessment_prognosis: formData.assessment_prognosis || null,
 plan_treatment: formData.plan_treatment,
 plan_medications: formData.plan_medications || null,
 plan_follow_up: formData.plan_follow_up || null,
 plan_client_education: formData.plan_client_education || null,
 plan_referral: formData.plan_referral || null,
 status,
 finalized_at: status ==="finalized" ? new Date().toISOString() : null,
 };

 if (existingNote) {
 const updateData = status ==="amended" 
 ? { ...noteData, amended_at: new Date().toISOString(), amendment_reason:"Updated by veterinarian" }
 : noteData;
 
 const { error } = await supabase
 .from("pet_soap_notes")
 .update(updateData)
 .eq("id", existingNote.id);

 if (error) throw error;
 } else {
 const { error } = await supabase
 .from("pet_soap_notes")
 .insert(noteData);

 if (error) throw error;
 }

 onSave();
 } catch (error: any) {
 console.error("Error saving SOAP note:", error);
 toast.error(error.message ||"Failed to save SOAP note");
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Button variant="ghost" onClick={onCancel}>
 <ArrowLeft className="w-4 h-4 mr-2" />
 Back
 </Button>
 <h2 className="text-2xl font-bold">
 {existingNote ?"Edit SOAP Note" :"New SOAP Note"}
 </h2>
 {existingNote && (
 <Badge variant={existingNote.status ==="finalized" ?"default" :"secondary"}>
 {existingNote.status}
 </Badge>
 )}
 </div>
 <div className="flex gap-2">
 <Button
 variant="outline"
 onClick={() => handleSubmit("draft")}
 disabled={isSubmitting}
 >
 {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
 Save Draft
 </Button>
 <Button onClick={() => handleSubmit("finalized")} disabled={isSubmitting}>
 {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
 Finalize
 </Button>
 </div>
 </div>

 <div className="grid gap-6">
 {/* Subjective Section */}
 <Card className="p-6">
 <div className="flex items-center gap-2 mb-4">
 <div className="w-8 h-8 rounded-full bg-info/10 /30 flex items-center justify-center">
 <FileText className="w-4 h-4 text-info" />
 </div>
 <h3 className="text-lg font-semibold">Subjective</h3>
 <span className="text-sm text-muted-foreground">- Owner's observations and history</span>
 </div>
 <div className="grid gap-4">
 <div>
 <Label htmlFor="chief_complaint">Chief Complaint *</Label>
 <Input
 id="chief_complaint"
 value={formData.subjective_chief_complaint}
 onChange={(e) => handleChange("subjective_chief_complaint", e.target.value)}
 placeholder="Primary reason for visit (e.g.,'Not eating for 2 days')"
 />
 </div>
 <div className="grid gap-4 md:grid-cols-2">
 <div>
 <Label htmlFor="duration">Duration</Label>
 <Input
 id="duration"
 value={formData.subjective_duration}
 onChange={(e) => handleChange("subjective_duration", e.target.value)}
 placeholder="e.g.,'3 days','Since yesterday'"
 />
 </div>
 <div>
 <Label htmlFor="history">Medical History</Label>
 <Input
 id="history"
 value={formData.subjective_history}
 onChange={(e) => handleChange("subjective_history", e.target.value)}
 placeholder="Relevant prior conditions or treatments"
 />
 </div>
 </div>
 <div>
 <Label htmlFor="owner_observations">Owner Observations</Label>
 <Textarea
 id="owner_observations"
 value={formData.subjective_owner_observations}
 onChange={(e) => handleChange("subjective_owner_observations", e.target.value)}
 placeholder="What has the owner noticed about the pet's behavior or condition?"
 rows={3}
 />
 </div>
 </div>
 </Card>

 {/* Objective Section */}
 <Card className="p-6">
 <div className="flex items-center gap-2 mb-4">
 <div className="w-8 h-8 rounded-full bg-success/10 /30 flex items-center justify-center">
 <Stethoscope className="w-4 h-4 text-success" />
 </div>
 <h3 className="text-lg font-semibold">Objective</h3>
 <span className="text-sm text-muted-foreground">- Clinical findings and vitals</span>
 </div>
 <div className="grid gap-4">
 <div className="grid gap-4 md:grid-cols-5">
 <div>
 <Label htmlFor="temperature">Temp (°F)</Label>
 <Input
 id="temperature"
 type="number"
 step="0.1"
 value={formData.objective_temperature}
 onChange={(e) => handleChange("objective_temperature", e.target.value)}
 placeholder="101.5"
 />
 </div>
 <div>
 <Label htmlFor="weight">Weight (lbs)</Label>
 <Input
 id="weight"
 type="number"
 step="0.1"
 value={formData.objective_weight}
 onChange={(e) => handleChange("objective_weight", e.target.value)}
 placeholder="25.5"
 />
 </div>
 <div>
 <Label htmlFor="heart_rate">Heart Rate</Label>
 <Input
 id="heart_rate"
 type="number"
 value={formData.objective_heart_rate}
 onChange={(e) => handleChange("objective_heart_rate", e.target.value)}
 placeholder="120 bpm"
 />
 </div>
 <div>
 <Label htmlFor="resp_rate">Resp Rate</Label>
 <Input
 id="resp_rate"
 type="number"
 value={formData.objective_respiratory_rate}
 onChange={(e) => handleChange("objective_respiratory_rate", e.target.value)}
 placeholder="24 /min"
 />
 </div>
 <div>
 <Label htmlFor="bcs">BCS (1-9)</Label>
 <Select
 value={formData.objective_body_condition_score}
 onValueChange={(value) => handleChange("objective_body_condition_score", value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select" />
 </SelectTrigger>
 <SelectContent>
 {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
 <SelectItem key={n} value={n.toString()}>
 {n}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 <div>
 <Label htmlFor="physical_exam">Physical Examination *</Label>
 <Textarea
 id="physical_exam"
 value={formData.objective_physical_exam}
 onChange={(e) => handleChange("objective_physical_exam", e.target.value)}
 placeholder="Systematic physical examination findings (HEENT, cardiovascular, respiratory, abdominal, musculoskeletal, neurological, skin/coat, lymph nodes...)"
 rows={5}
 />
 </div>
 <div>
 <Label htmlFor="findings">Additional Findings</Label>
 <Textarea
 id="findings"
 value={formData.objective_findings}
 onChange={(e) => handleChange("objective_findings", e.target.value)}
 placeholder="Any additional objective findings, test results, or observations"
 rows={2}
 />
 </div>
 </div>
 </Card>

 {/* Assessment Section */}
 <Card className="p-6">
 <div className="flex items-center gap-2 mb-4">
 <div className="w-8 h-8 rounded-full bg-primary/10 /30 flex items-center justify-center">
 <ClipboardList className="w-4 h-4 text-primary" />
 </div>
 <h3 className="text-lg font-semibold">Assessment</h3>
 <span className="text-sm text-muted-foreground">- Diagnosis and differential</span>
 </div>
 <div className="grid gap-4">
 <div>
 <Label htmlFor="primary_diagnosis">Primary Diagnosis *</Label>
 <Input
 id="primary_diagnosis"
 value={formData.assessment_primary_diagnosis}
 onChange={(e) => handleChange("assessment_primary_diagnosis", e.target.value)}
 placeholder="e.g., Acute gastroenteritis, Otitis externa, etc."
 />
 </div>
 <div>
 <Label htmlFor="differential">Differential Diagnoses</Label>
 <Input
 id="differential"
 value={formData.assessment_differential_diagnoses}
 onChange={(e) => handleChange("assessment_differential_diagnoses", e.target.value)}
 placeholder="Comma-separated list (e.g., Pancreatitis, Foreign body, IBD)"
 />
 </div>
 <div>
 <Label htmlFor="prognosis">Prognosis</Label>
 <Select
 value={formData.assessment_prognosis}
 onValueChange={(value) => handleChange("assessment_prognosis", value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select prognosis" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="excellent">Excellent</SelectItem>
 <SelectItem value="good">Good</SelectItem>
 <SelectItem value="fair">Fair</SelectItem>
 <SelectItem value="guarded">Guarded</SelectItem>
 <SelectItem value="poor">Poor</SelectItem>
 <SelectItem value="grave">Grave</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </Card>

 {/* Plan Section */}
 <Card className="p-6">
 <div className="flex items-center gap-2 mb-4">
 <div className="w-8 h-8 rounded-full bg-warning/10 /30 flex items-center justify-center">
 <Pill className="w-4 h-4 text-warning" />
 </div>
 <h3 className="text-lg font-semibold">Plan</h3>
 <span className="text-sm text-muted-foreground">- Treatment and follow-up</span>
 </div>
 <div className="grid gap-4">
 <div>
 <Label htmlFor="treatment">Treatment Plan *</Label>
 <Textarea
 id="treatment"
 value={formData.plan_treatment}
 onChange={(e) => handleChange("plan_treatment", e.target.value)}
 placeholder="Describe the treatment plan including diagnostics, procedures, and therapies"
 rows={3}
 />
 </div>
 <div>
 <Label htmlFor="medications">Medications</Label>
 <Textarea
 id="medications"
 value={formData.plan_medications}
 onChange={(e) => handleChange("plan_medications", e.target.value)}
 placeholder="List medications with dosage, route, frequency, and duration"
 rows={3}
 />
 </div>
 <div className="grid gap-4 md:grid-cols-2">
 <div>
 <Label htmlFor="follow_up">Follow-up Instructions</Label>
 <Textarea
 id="follow_up"
 value={formData.plan_follow_up}
 onChange={(e) => handleChange("plan_follow_up", e.target.value)}
 placeholder="When to return, what to monitor for"
 rows={2}
 />
 </div>
 <div>
 <Label htmlFor="client_education">Client Education</Label>
 <Textarea
 id="client_education"
 value={formData.plan_client_education}
 onChange={(e) => handleChange("plan_client_education", e.target.value)}
 placeholder="Home care instructions, dietary recommendations"
 rows={2}
 />
 </div>
 </div>
 <div>
 <Label htmlFor="referral">Referral</Label>
 <Input
 id="referral"
 value={formData.plan_referral}
 onChange={(e) => handleChange("plan_referral", e.target.value)}
 placeholder="Specialist referral if applicable"
 />
 </div>
 </div>
 </Card>
 </div>
 </div>
 );
};
