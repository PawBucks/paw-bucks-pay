import { useState } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Textarea } from"@/components/ui/textarea";
import { ScrollArea } from"@/components/ui/scroll-area";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog";
import { AlertTriangle, CheckCircle, Clock, Eye, FileQuestion, Loader2, RefreshCw, Stethoscope, TestTube } from "lucide-react";
import { toast } from"sonner";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";

interface SymptomTriageQueueProps {
 vetId: string;
}

const urgencyColors: Record<string, string> = {
 emergency:"bg-destructive text-white",
 urgent:"bg-warning text-white",
 soon:"bg-warning text-black",
 routine:"bg-success text-white",
};

const urgencyIcons: Record<string, any> = {
 emergency: AlertTriangle,
 urgent: Clock,
 soon: Clock,
 routine: CheckCircle,
};

export const SymptomTriageQueue = ({ vetId }: SymptomTriageQueueProps) => {
 const [selectedAssessment, setSelectedAssessment] = useState<any>(null);
 const [vetNotes, setVetNotes] = useState("");
 const queryClient = useQueryClient();

 // Fetch pending triage assessments
 const { data: assessments, isLoading, refetch } = useQuery({
 queryKey: ["triage-queue", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("symptom_triage_assessments")
 .select(`
 *,
 pet:pet_profiles(name, species, breed, date_of_birth, photo_url),
 owner:profiles(full_name, email, phone)
 `)
 .or(`vet_id.eq.${vetId},vet_id.is.null`)
 .in("status", ["ready","pending","analyzing"])
 .order("ai_urgency_score", { ascending: false, nullsFirst: false })
 .order("created_at", { ascending: true });

 if (error) throw error;
 return data || [];
 },
 refetchInterval: 30000, // Refetch every 30 seconds
 });

 // Mark as reviewed mutation
 const markReviewedMutation = useMutation({
 mutationFn: async ({ assessmentId, notes }: { assessmentId: string; notes: string }) => {
 const { error } = await supabase
 .from("symptom_triage_assessments")
 .update({
 status:"reviewed",
 reviewed_at: new Date().toISOString(),
 reviewed_by: vetId,
 vet_notes: notes,
 })
 .eq("id", assessmentId);

 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["triage-queue"] });
 toast.success("Assessment marked as reviewed");
 setSelectedAssessment(null);
 setVetNotes("");
 },
 onError: (error: any) => {
 toast.error(error.message ||"Failed to update assessment");
 },
 });

 // Trigger AI analysis for pending assessments
 const triggerAIMutation = useMutation({
 mutationFn: async (assessmentId: string) => {
 const { data, error } = await supabase.functions.invoke("ai-symptom-triage", {
 body: { assessment_id: assessmentId },
 });

 if (error) throw error;
 return data;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["triage-queue"] });
 toast.success("AI analysis complete");
 },
 onError: (error: any) => {
 toast.error(error.message ||"Failed to analyze symptoms");
 },
 });

 const formatDate = (date: string) => {
 return new Date(date).toLocaleString();
 };

 const calculateAge = (dateOfBirth: string): string => {
 const birth = new Date(dateOfBirth);
 const now = new Date();
 const years = Math.floor(
 (now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
 );
 const months = Math.floor(
 ((now.getTime() - birth.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) /
 (30.44 * 24 * 60 * 60 * 1000)
 );
 return years > 0 ? `${years}y ${months}m` : `${months}m`;
 };

 return (
 <div className="space-y-6">
 {/* Queue Header */}
 <Card className="p-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 /30 flex items-center justify-center">
 <ClipboardCheck className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h3 className="text-lg font-semibold">Symptom Triage Queue</h3>
 <p className="text-sm text-muted-foreground">
 AI-analyzed pre-check-in assessments from pet owners
 </p>
 </div>
 </div>
 <Button variant="outline" onClick={() => refetch()}>
 <RefreshCw className="w-4 h-4 mr-2" />
 Refresh
 </Button>
 </div>

 {/* Urgency Legend */}
 <div className="flex gap-4 mt-4 pt-4 border-t">
 {Object.entries(urgencyColors).map(([level, color]) => (
 <div key={level} className="flex items-center gap-2">
 <div className={`w-3 h-3 rounded-full ${color}`} />
 <span className="text-xs capitalize">{level}</span>
 </div>
 ))}
 </div>
 </Card>

 {/* Queue List */}
 {isLoading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-primary" />
 </div>
 ) : assessments && assessments.length > 0 ? (
 <div className="space-y-3">
 {assessments.map((assessment: any) => {
 const UrgencyIcon = assessment.ai_urgency_level
 ? urgencyIcons[assessment.ai_urgency_level]
 : Clock;

 return (
 <Card
 key={assessment.id}
 className="p-4 hover:shadow-md transition-shadow cursor-pointer"
 onClick={() => setSelectedAssessment(assessment)}
 >
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-4">
 {assessment.pet?.photo_url ? (
 <img
 src={assessment.pet.photo_url}
 alt={assessment.pet.name}
 className="w-12 h-12 rounded-full object-cover"
 />
 ) : (
 <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
 <Stethoscope className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
 </div>
 )}
 <div>
 <div className="flex items-center gap-2">
 <h4 className="font-semibold">{assessment.pet?.name}</h4>
 <span className="text-sm text-muted-foreground">
 {assessment.pet?.species} • {assessment.pet?.breed}
 </span>
 {assessment.pet?.date_of_birth && (
 <span className="text-sm text-muted-foreground">
 • {calculateAge(assessment.pet.date_of_birth)}
 </span>
 )}
 </div>
 <p className="text-sm font-medium mt-1">
 {assessment.chief_complaint}
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 Submitted {formatDate(assessment.created_at)} by{""}
 {assessment.owner?.full_name}
 </p>
 </div>
 </div>

 <div className="flex flex-col items-end gap-2">
 {assessment.ai_urgency_level ? (
 <Badge
 className={urgencyColors[assessment.ai_urgency_level]}
 >
 <UrgencyIcon className="w-3 h-3 mr-1" />
 {assessment.ai_urgency_level.toUpperCase()}
 {assessment.ai_urgency_score && (
 <span className="ml-1">({assessment.ai_urgency_score}/10)</span>
 )}
 </Badge>
 ) : assessment.status ==="pending" ? (
 <Button
 size="sm"
 variant="outline"
 onClick={(e) => {
 e.stopPropagation();
 triggerAIMutation.mutate(assessment.id);
 }}
 disabled={triggerAIMutation.isPending}
 >
 {triggerAIMutation.isPending ? (
 <Loader2 className="w-3 h-3 mr-1 animate-spin" />
 ) : null}
 Analyze
 </Button>
 ) : (
 <Badge variant="secondary">
 <Loader2 className="w-3 h-3 mr-1 animate-spin" />
 Analyzing...
 </Badge>
 )}
 <Button size="sm" variant="ghost">
 <Eye className="w-4 h-4 mr-1" />
 View Details
 </Button>
 </div>
 </div>

 {assessment.ai_summary && (
 <div className="mt-3 pt-3 border-t">
 <p className="text-sm text-muted-foreground">
 <span className="font-medium">AI Summary:</span>{""}
 {assessment.ai_summary}
 </p>
 </div>
 )}
 </Card>
 );
 })}
 </div>
 ) : (
 <Card className="p-12 text-center">
 <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
 <h3 className="text-lg font-semibold">Queue is Clear</h3>
 <p className="text-muted-foreground">
 No pending symptom assessments at this time
 </p>
 </Card>
 )}

 {/* Detail Dialog */}
 <Dialog
 open={!!selectedAssessment}
 onOpenChange={() => setSelectedAssessment(null)}
 >
 <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-3">
 Symptom Assessment Details
 {selectedAssessment?.ai_urgency_level && (
 <Badge
 className={urgencyColors[selectedAssessment.ai_urgency_level]}
 >
 {selectedAssessment.ai_urgency_level.toUpperCase()} (
 {selectedAssessment.ai_urgency_score}/10)
 </Badge>
 )}
 </DialogTitle>
 </DialogHeader>

 <ScrollArea className="flex-1 pr-4">
 {selectedAssessment && (
 <div className="space-y-6">
 {/* Patient Info */}
 <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
 {selectedAssessment.pet?.photo_url ? (
 <img
 src={selectedAssessment.pet.photo_url}
 alt={selectedAssessment.pet.name}
 className="w-16 h-16 rounded-full object-cover"
 />
 ) : (
 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
 <Stethoscope className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
 </div>
 )}
 <div>
 <h3 className="text-xl font-semibold">
 {selectedAssessment.pet?.name}
 </h3>
 <p className="text-muted-foreground">
 {selectedAssessment.pet?.species} •{""}
 {selectedAssessment.pet?.breed}
 {selectedAssessment.pet?.date_of_birth &&
 ` • ${calculateAge(selectedAssessment.pet.date_of_birth)}`}
 </p>
 <p className="text-sm text-muted-foreground">
 Owner: {selectedAssessment.owner?.full_name} (
 {selectedAssessment.owner?.phone || selectedAssessment.owner?.email})
 </p>
 </div>
 </div>

 {/* Chief Complaint */}
 <div>
 <h4 className="font-semibold mb-2">Chief Complaint</h4>
 <p className="p-3 bg-destructive/10 /20 rounded-lg">
 {selectedAssessment.chief_complaint}
 </p>
 </div>

 {/* Symptom Details */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <h4 className="font-semibold mb-2">Duration</h4>
 <p className="text-sm">
 {selectedAssessment.symptom_duration ||"Not specified"}
 </p>
 </div>
 <div>
 <h4 className="font-semibold mb-2">Onset</h4>
 <p className="text-sm capitalize">
 {selectedAssessment.symptom_onset ||"Not specified"}
 </p>
 </div>
 <div>
 <h4 className="font-semibold mb-2">Progression</h4>
 <p className="text-sm capitalize">
 {selectedAssessment.symptom_progression ||"Not specified"}
 </p>
 </div>
 </div>

 {/* Vital Observations */}
 <div>
 <h4 className="font-semibold mb-2">Owner Observations</h4>
 <div className="grid grid-cols-2 gap-2 text-sm">
 <div className="p-2 bg-muted rounded">
 <span className="text-muted-foreground">Eating:</span>{""}
 {selectedAssessment.eating_status ||"Normal"}
 </div>
 <div className="p-2 bg-muted rounded">
 <span className="text-muted-foreground">Drinking:</span>{""}
 {selectedAssessment.drinking_status ||"Normal"}
 </div>
 <div className="p-2 bg-muted rounded">
 <span className="text-muted-foreground">Energy:</span>{""}
 {selectedAssessment.energy_level ||"Normal"}
 </div>
 <div className="p-2 bg-muted rounded">
 <span className="text-muted-foreground">Bathroom:</span>{""}
 {selectedAssessment.bathroom_habits ||"Normal"}
 </div>
 </div>
 </div>

 {/* AI Analysis */}
 {selectedAssessment.ai_summary && (
 <>
 <div>
 <h4 className="font-semibold mb-2 flex items-center gap-2">
 <Stethoscope className="w-4 h-4" aria-hidden="true" />
 AI Triage Summary
 </h4>
 <p className="p-3 bg-primary/10 /20 rounded-lg">
 {selectedAssessment.ai_summary}
 </p>
 </div>

 {selectedAssessment.ai_triage_reasoning && (
 <div>
 <h4 className="font-semibold mb-2">Triage Reasoning</h4>
 <p className="text-sm text-muted-foreground">
 {selectedAssessment.ai_triage_reasoning}
 </p>
 </div>
 )}

 {/* Differential Considerations */}
 {selectedAssessment.ai_differential_considerations?.length > 0 && (
 <div>
 <h4 className="font-semibold mb-2 flex items-center gap-2">
 <FileQuestion className="w-4 h-4" />
 Differential Considerations
 </h4>
 <div className="space-y-2">
 {selectedAssessment.ai_differential_considerations.map(
 (diff: any, idx: number) => (
 <div
 key={idx}
 className="p-3 border rounded-lg"
 >
 <div className="flex items-center justify-between">
 <span className="font-medium">
 {diff.condition}
 </span>
 <Badge
 variant={
 diff.likelihood ==="high"
 ?"destructive"
 : diff.likelihood ==="moderate"
 ?"default"
 :"secondary"
 }
 >
 {diff.likelihood}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground mt-1">
 {diff.reasoning}
 </p>
 </div>
 )
 )}
 </div>
 </div>
 )}

 {/* Recommended Questions */}
 {selectedAssessment.ai_recommended_questions?.length > 0 && (
 <div>
 <h4 className="font-semibold mb-2">
 Questions to Ask Owner
 </h4>
 <ul className="space-y-1">
 {selectedAssessment.ai_recommended_questions.map(
 (q: string, idx: number) => (
 <li
 key={idx}
 className="text-sm flex items-start gap-2"
 >
 <span className="text-primary">•</span>
 {q}
 </li>
 )
 )}
 </ul>
 </div>
 )}

 {/* Recommended Diagnostics */}
 {selectedAssessment.ai_recommended_diagnostics?.length > 0 && (
 <div>
 <h4 className="font-semibold mb-2 flex items-center gap-2">
 <TestTube className="w-4 h-4" />
 Recommended Diagnostics
 </h4>
 <div className="space-y-2">
 {selectedAssessment.ai_recommended_diagnostics.map(
 (diag: any, idx: number) => (
 <div
 key={idx}
 className="p-2 bg-muted rounded flex items-center justify-between"
 >
 <div>
 <span className="font-medium">{diag.test}</span>
 <p className="text-xs text-muted-foreground">
 {diag.reasoning}
 </p>
 </div>
 <Badge
 variant={
 diag.priority ==="high"
 ?"destructive"
 : diag.priority ==="medium"
 ?"default"
 :"secondary"
 }
 >
 {diag.priority}
 </Badge>
 </div>
 )
 )}
 </div>
 </div>
 )}
 </>
 )}

 {/* Vet Notes */}
 <div>
 <h4 className="font-semibold mb-2">Your Notes</h4>
 <Textarea
 value={vetNotes}
 onChange={(e) => setVetNotes(e.target.value)}
 placeholder="Add your clinical notes before marking as reviewed..."
 rows={3}
 />
 </div>

 <Button
 className="w-full"
 onClick={() =>
 markReviewedMutation.mutate({
 assessmentId: selectedAssessment.id,
 notes: vetNotes,
 })
 }
 disabled={markReviewedMutation.isPending}
 >
 {markReviewedMutation.isPending ? (
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 ) : (
 <CheckCircle className="w-4 h-4 mr-2" />
 )}
 Mark as Reviewed
 </Button>
 </div>
 )}
 </ScrollArea>
 </DialogContent>
 </Dialog>
 </div>
 );
};

// Add missing import
import { ClipboardCheck } from "lucide-react";
