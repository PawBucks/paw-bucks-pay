import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Checkbox } from"@/components/ui/checkbox";
import { Badge } from"@/components/ui/badge";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 AlertTriangle,
 Clock,
 CheckCircle,
 Send,
 Loader2,
 Stethoscope,
 Camera,
} from"lucide-react";
import { toast } from"sonner";
import { useQuery, useMutation } from"@tanstack/react-query";
import { useAuth } from"@/hooks/useAuth";

interface SymptomTriageFormProps {
 petId?: string;
 onComplete?: () => void;
}

interface SymptomCategory {
 category: string;
 symptoms: Array<{
 id: string;
 symptom_name: string;
 symptom_description: string;
 urgency_weight: number;
 }>;
}

export const SymptomTriageForm = ({ petId, onComplete }: SymptomTriageFormProps) => {
 const { user } = useAuth();
 const [step, setStep] = useState(1);
 const [selectedPetId, setSelectedPetId] = useState(petId ||"");
 const [formData, setFormData] = useState({
 chiefComplaint:"",
 duration:"",
 onset:"",
 progression:"",
 selectedSymptoms: [] as string[],
 affectedAreas: [] as string[],
 behavioralChanges: [] as string[],
 eatingStatus:"",
 drinkingStatus:"",
 energyLevel:"",
 bathroomHabits:"",
 recentChanges:"",
 currentMedications:"",
 knownAllergies:"",
 additionalNotes:"",
 });
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [submittedAssessment, setSubmittedAssessment] = useState<any>(null);

 // Fetch user's pets
 const { data: pets } = useQuery({
 queryKey: ["user-pets-triage", user?.id],
 queryFn: async () => {
 if (!user) return [];
 const { data, error } = await supabase
 .from("pet_profiles")
 .select("id, name, type, breed, photo_url")
 .eq("user_id", user.id)
 .order("name");

 if (error) throw error;
 return (data || []) as any[];
 },
 enabled: !!user,
 });

 // Fetch symptom library
 const { data: symptomLibrary } = useQuery({
 queryKey: ["symptom-library"],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("symptom_library")
 .select("*")
 .eq("is_active", true)
 .order("category")
 .order("urgency_weight", { ascending: false });

 if (error) throw error;

 // Group by category
 const grouped: Record<string, any[]> = {};
 data?.forEach((symptom) => {
 if (!grouped[symptom.category]) {
 grouped[symptom.category] = [];
 }
 grouped[symptom.category].push(symptom);
 });

 return Object.entries(grouped).map(([category, symptoms]) => ({
 category,
 symptoms,
 })) as SymptomCategory[];
 },
 });

 // Submit assessment mutation
 const submitMutation = useMutation({
 mutationFn: async () => {
 if (!user || !selectedPetId) {
 throw new Error("Please select a pet");
 }

 // Create assessment record
 const { data: assessment, error: createError } = await supabase
 .from("symptom_triage_assessments")
 .insert({
 pet_id: selectedPetId,
 owner_id: user.id,
 chief_complaint: formData.chiefComplaint,
 symptom_duration: formData.duration,
 symptom_onset: formData.onset || null,
 symptom_progression: formData.progression || null,
 symptoms: formData.selectedSymptoms,
 affected_body_areas: formData.affectedAreas,
 behavioral_changes: formData.behavioralChanges,
 eating_status: formData.eatingStatus || null,
 drinking_status: formData.drinkingStatus || null,
 energy_level: formData.energyLevel || null,
 bathroom_habits: formData.bathroomHabits || null,
 recent_changes: formData.recentChanges || null,
 current_medications: formData.currentMedications || null,
 known_allergies: formData.knownAllergies || null,
 additional_notes: formData.additionalNotes || null,
 status:"pending",
 })
 .select()
 .single();

 if (createError) throw createError;

 // Trigger AI analysis
 const { data, error } = await supabase.functions.invoke("ai-symptom-triage", {
 body: { assessment_id: assessment.id },
 });

 if (error) {
 console.error("AI analysis error:", error);
 // Don't fail the submission if AI analysis fails
 }

 // Refetch to get AI results
 const { data: updatedAssessment } = await supabase
 .from("symptom_triage_assessments")
 .select("*")
 .eq("id", assessment.id)
 .single();

 return updatedAssessment || assessment;
 },
 onSuccess: (data) => {
 setSubmittedAssessment(data);
 setStep(4);
 toast.success("Symptom assessment submitted successfully!");
 },
 onError: (error: any) => {
 toast.error(error.message ||"Failed to submit assessment");
 },
 });

 const toggleSymptom = (symptomName: string) => {
 setFormData((prev) => ({
 ...prev,
 selectedSymptoms: prev.selectedSymptoms.includes(symptomName)
 ? prev.selectedSymptoms.filter((s) => s !== symptomName)
 : [...prev.selectedSymptoms, symptomName],
 }));
 };

 const bodyAreas = [
"Head/Face",
"Eyes",
"Ears",
"Mouth/Teeth",
"Neck",
"Chest",
"Abdomen",
"Back",
"Front legs",
"Back legs",
"Paws",
"Tail",
"Skin/Coat",
"General/Whole body",
 ];

 const behaviorOptions = [
"Hiding more than usual",
"More aggressive",
"More clingy/needy",
"Less playful",
"Restless/pacing",
"Vocalizing more",
"Not grooming",
"Sleeping more",
"Sleeping less",
 ];

 const selectedPet = pets?.find((p) => p.id === selectedPetId);

 const urgencyColors: Record<string, string> = {
 emergency:"bg-destructive text-white",
 urgent:"bg-warning text-white",
 soon:"bg-warning text-black",
 routine:"bg-success text-white",
 };

 return (
 <div className="max-w-2xl mx-auto space-y-6">
 {/* Progress Steps */}
 <div className="flex items-center justify-between">
 {[1, 2, 3].map((s) => (
 <div
 key={s}
 className={`flex items-center ${s < 3 ?"flex-1" :""}`}
 >
 <div
 className={`w-8 h-8 rounded-full flex items-center justify-center ${
 step >= s
 ?"bg-primary text-primary-foreground"
 :"bg-muted text-muted-foreground"
 }`}
 >
 {step > s ? <CheckCircle className="w-5 h-5" /> : s}
 </div>
 {s < 3 && (
 <div
 className={`flex-1 h-1 mx-2 ${
 step > s ?"bg-primary" :"bg-muted"
 }`}
 />
 )}
 </div>
 ))}
 </div>

 {/* Step 1: Chief Complaint */}
 {step === 1 && (
 <Card className="p-6">
 <h2 className="text-xl font-semibold mb-4">What's Wrong?</h2>
 <p className="text-muted-foreground mb-6">
 Tell us about your pet's symptoms so we can help your vet prepare.
 </p>

 <div className="space-y-4">
 <div>
 <Label>Select Pet *</Label>
 <Select value={selectedPetId} onValueChange={setSelectedPetId}>
 <SelectTrigger>
 <SelectValue placeholder="Choose your pet..." />
 </SelectTrigger>
 <SelectContent>
 {pets?.map((pet) => (
 <SelectItem key={pet.id} value={pet.id}>
 <div className="flex items-center gap-2">
 {pet.photo_url ? (
 <img
 src={pet.photo_url}
 alt={pet.name}
 className="w-6 h-6 rounded-full object-cover"
 />
 ) : (
 <div className="w-6 h-6 rounded-full bg-muted" />
 )}
 {pet.name} ({pet.type})
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label>Main Concern *</Label>
 <Textarea
 value={formData.chiefComplaint}
 onChange={(e) =>
 setFormData({ ...formData, chiefComplaint: e.target.value })
 }
 placeholder="Describe what's happening with your pet in your own words..."
 rows={3}
 />
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div>
 <Label>How Long?</Label>
 <Input
 value={formData.duration}
 onChange={(e) =>
 setFormData({ ...formData, duration: e.target.value })
 }
 placeholder="e.g., 2 days"
 />
 </div>
 <div>
 <Label>Onset</Label>
 <Select
 value={formData.onset}
 onValueChange={(v) => setFormData({ ...formData, onset: v })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="sudden">Sudden</SelectItem>
 <SelectItem value="gradual">Gradual</SelectItem>
 <SelectItem value="unknown">Not sure</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Getting...</Label>
 <Select
 value={formData.progression}
 onValueChange={(v) =>
 setFormData({ ...formData, progression: v })
 }
 >
 <SelectTrigger>
 <SelectValue placeholder="Select..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="improving">Better</SelectItem>
 <SelectItem value="stable">Same</SelectItem>
 <SelectItem value="worsening">Worse</SelectItem>
 <SelectItem value="fluctuating">Up & Down</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>

 <Button
 className="w-full mt-6"
 onClick={() => setStep(2)}
 disabled={!selectedPetId || !formData.chiefComplaint}
 >
 Continue
 </Button>
 </Card>
 )}

 {/* Step 2: Symptoms Selection */}
 {step === 2 && (
 <Card className="p-6">
 <h2 className="text-xl font-semibold mb-4">Select Symptoms</h2>
 <p className="text-muted-foreground mb-6">
 Check all symptoms you've noticed in {selectedPet?.name}.
 </p>

 <div className="space-y-6">
 {symptomLibrary?.map((category) => (
 <div key={category.category}>
 <h3 className="font-medium capitalize mb-2">
 {category.category.replace("_","")}
 </h3>
 <div className="flex flex-wrap gap-2">
 {category.symptoms.map((symptom) => (
 <Badge
 key={symptom.id}
 variant={
 formData.selectedSymptoms.includes(symptom.symptom_name)
 ?"default"
 :"outline"
 }
 className="cursor-pointer"
 onClick={() => toggleSymptom(symptom.symptom_name)}
 >
 {symptom.urgency_weight >= 7 && (
 <AlertTriangle className="w-3 h-3 mr-1 text-destructive" />
 )}
 {symptom.symptom_name}
 </Badge>
 ))}
 </div>
 </div>
 ))}

 <div>
 <h3 className="font-medium mb-2">Affected Body Areas</h3>
 <div className="flex flex-wrap gap-2">
 {bodyAreas.map((area) => (
 <Badge
 key={area}
 variant={
 formData.affectedAreas.includes(area) ?"default" :"outline"
 }
 className="cursor-pointer"
 onClick={() =>
 setFormData((prev) => ({
 ...prev,
 affectedAreas: prev.affectedAreas.includes(area)
 ? prev.affectedAreas.filter((a) => a !== area)
 : [...prev.affectedAreas, area],
 }))
 }
 >
 {area}
 </Badge>
 ))}
 </div>
 </div>

 <div>
 <h3 className="font-medium mb-2">Behavioral Changes</h3>
 <div className="flex flex-wrap gap-2">
 {behaviorOptions.map((behavior) => (
 <Badge
 key={behavior}
 variant={
 formData.behavioralChanges.includes(behavior)
 ?"default"
 :"outline"
 }
 className="cursor-pointer"
 onClick={() =>
 setFormData((prev) => ({
 ...prev,
 behavioralChanges: prev.behavioralChanges.includes(behavior)
 ? prev.behavioralChanges.filter((b) => b !== behavior)
 : [...prev.behavioralChanges, behavior],
 }))
 }
 >
 {behavior}
 </Badge>
 ))}
 </div>
 </div>
 </div>

 <div className="flex gap-3 mt-6">
 <Button variant="outline" onClick={() => setStep(1)}>
 Back
 </Button>
 <Button className="flex-1" onClick={() => setStep(3)}>
 Continue
 </Button>
 </div>
 </Card>
 )}

 {/* Step 3: Additional Info */}
 {step === 3 && (
 <Card className="p-6">
 <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
 <p className="text-muted-foreground mb-6">
 Help your vet understand {selectedPet?.name}'s current condition.
 </p>

 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label>Eating</Label>
 <Select
 value={formData.eatingStatus}
 onValueChange={(v) =>
 setFormData({ ...formData, eatingStatus: v })
 }
 >
 <SelectTrigger>
 <SelectValue placeholder="Select..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="normal">Normal</SelectItem>
 <SelectItem value="decreased">Eating less</SelectItem>
 <SelectItem value="not_eating">Not eating</SelectItem>
 <SelectItem value="increased">Eating more</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Drinking</Label>
 <Select
 value={formData.drinkingStatus}
 onValueChange={(v) =>
 setFormData({ ...formData, drinkingStatus: v })
 }
 >
 <SelectTrigger>
 <SelectValue placeholder="Select..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="normal">Normal</SelectItem>
 <SelectItem value="decreased">Drinking less</SelectItem>
 <SelectItem value="not_drinking">Not drinking</SelectItem>
 <SelectItem value="increased">Drinking more</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Energy Level</Label>
 <Select
 value={formData.energyLevel}
 onValueChange={(v) =>
 setFormData({ ...formData, energyLevel: v })
 }
 >
 <SelectTrigger>
 <SelectValue placeholder="Select..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="normal">Normal</SelectItem>
 <SelectItem value="low">Low/Tired</SelectItem>
 <SelectItem value="very_low">Very weak</SelectItem>
 <SelectItem value="hyperactive">Hyperactive</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Bathroom Habits</Label>
 <Select
 value={formData.bathroomHabits}
 onValueChange={(v) =>
 setFormData({ ...formData, bathroomHabits: v })
 }
 >
 <SelectTrigger>
 <SelectValue placeholder="Select..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="normal">Normal</SelectItem>
 <SelectItem value="diarrhea">Diarrhea</SelectItem>
 <SelectItem value="constipation">Constipation</SelectItem>
 <SelectItem value="blood_present">Blood present</SelectItem>
 <SelectItem value="straining">Straining</SelectItem>
 <SelectItem value="accidents">Having accidents</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 <div>
 <Label>Recent Changes (diet, environment, etc.)</Label>
 <Textarea
 value={formData.recentChanges}
 onChange={(e) =>
 setFormData({ ...formData, recentChanges: e.target.value })
 }
 placeholder="Any recent changes that might be relevant..."
 rows={2}
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label>Current Medications</Label>
 <Input
 value={formData.currentMedications}
 onChange={(e) =>
 setFormData({ ...formData, currentMedications: e.target.value })
 }
 placeholder="List any medications..."
 />
 </div>
 <div>
 <Label>Known Allergies</Label>
 <Input
 value={formData.knownAllergies}
 onChange={(e) =>
 setFormData({ ...formData, knownAllergies: e.target.value })
 }
 placeholder="List any allergies..."
 />
 </div>
 </div>

 <div>
 <Label>Additional Notes</Label>
 <Textarea
 value={formData.additionalNotes}
 onChange={(e) =>
 setFormData({ ...formData, additionalNotes: e.target.value })
 }
 placeholder="Anything else you'd like the vet to know..."
 rows={3}
 />
 </div>
 </div>

 <div className="flex gap-3 mt-6">
 <Button variant="outline" onClick={() => setStep(2)}>
 Back
 </Button>
 <Button
 className="flex-1"
 onClick={() => submitMutation.mutate()}
 disabled={submitMutation.isPending}
 >
 {submitMutation.isPending ? (
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 ) : (
 <Send className="w-4 h-4 mr-2" />
 )}
 Submit Assessment
 </Button>
 </div>
 </Card>
 )}

 {/* Step 4: Results */}
 {step === 4 && submittedAssessment && (
 <Card className="p-6">
 <div className="text-center mb-6">
 <CheckCircle className="w-16 h-16 mx-auto text-success mb-4" />
 <h2 className="text-xl font-semibold">Assessment Submitted!</h2>
 <p className="text-muted-foreground">
 Your vet will review this before your appointment.
 </p>
 </div>

 {submittedAssessment.ai_urgency_level && (
 <div className="space-y-4">
 <div className="flex items-center justify-center gap-3">
 <span className="text-lg font-medium">Urgency Level:</span>
 <Badge
 className={`text-lg px-4 py-1 ${
 urgencyColors[submittedAssessment.ai_urgency_level]
 }`}
 >
 {submittedAssessment.ai_urgency_level.toUpperCase()}
 {submittedAssessment.ai_urgency_score && (
 <span className="ml-2">
 ({submittedAssessment.ai_urgency_score}/10)
 </span>
 )}
 </Badge>
 </div>

 {submittedAssessment.ai_urgency_level ==="emergency" && (
 <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
 <div className="flex items-start gap-3">
 <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
 <div>
 <p className="font-semibold text-destructive">
 Immediate Attention Recommended
 </p>
 <p className="text-sm text-destructive">
 Based on the symptoms described, we recommend seeking
 veterinary care as soon as possible. Please contact your vet
 or an emergency clinic.
 </p>
 </div>
 </div>
 </div>
 )}

 {submittedAssessment.ai_summary && (
 <div className="p-4 bg-muted rounded-lg">
 <p className="text-sm">{submittedAssessment.ai_summary}</p>
 </div>
 )}
 </div>
 )}

 <Button className="w-full mt-6" onClick={onComplete}>
 Done
 </Button>
 </Card>
 )}
 </div>
 );
};
