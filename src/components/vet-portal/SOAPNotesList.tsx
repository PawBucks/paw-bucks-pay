import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import {
 Accordion,
 AccordionContent,
 AccordionItem,
 AccordionTrigger,
} from"@/components/ui/accordion";
import { FileText, Edit, Clock, CheckCircle, AlertCircle } from"lucide-react";
import { format } from"date-fns";
import type { SOAPNote } from"./types";

interface SOAPNotesListProps {
 petId: string;
 vetId: string;
 refreshTrigger: number;
 onEdit: (note: SOAPNote) => void;
}

export const SOAPNotesList = ({ petId, vetId, refreshTrigger, onEdit }: SOAPNotesListProps) => {
 const [notes, setNotes] = useState<SOAPNote[]>([]);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
 loadNotes();
 }, [petId, refreshTrigger]);

 const loadNotes = async () => {
 try {
 const { data, error } = await supabase
 .from("pet_soap_notes")
 .select("*")
 .eq("pet_id", petId)
 .order("visit_date", { ascending: false });

 if (error) throw error;
 setNotes((data as SOAPNote[]) || []);
 } catch (error) {
 console.error("Error loading SOAP notes:", error);
 } finally {
 setIsLoading(false);
 }
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case"finalized":
 return <CheckCircle className="w-4 h-4 text-success" />;
 case"amended":
 return <AlertCircle className="w-4 h-4 text-warning" />;
 default:
 return <Clock className="w-4 h-4 text-muted-foreground" />;
 }
 };

 if (isLoading) {
 return <div className="text-center py-8 text-muted-foreground">Loading SOAP notes...</div>;
 }

 if (notes.length === 0) {
 return (
 <Card className="p-8 text-center text-muted-foreground">
 <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
 <p>No SOAP notes yet. Create a new note to get started.</p>
 </Card>
 );
 }

 return (
 <div className="space-y-4">
 {notes.map((note) => (
 <Card key={note.id} className="overflow-hidden">
 <Accordion type="single" collapsible>
 <AccordionItem value={note.id} className="border-none">
 <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent">
 <div className="flex items-center justify-between w-full pr-4">
 <div className="flex items-center gap-3">
 {getStatusIcon(note.status)}
 <div className="text-left">
 <p className="font-semibold">
 {format(new Date(note.visit_date),"MMMM d, yyyy'at' h:mm a")}
 </p>
 <p className="text-sm text-muted-foreground">
 {note.subjective_chief_complaint.substring(0, 60)}
 {note.subjective_chief_complaint.length > 60 ?"..." :""}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Badge
 variant={
 note.status ==="finalized"
 ?"default"
 : note.status ==="amended"
 ?"outline"
 :"secondary"
 }
 >
 {note.status}
 </Badge>
 <Button
 variant="ghost"
 size="sm"
 onClick={(e) => {
 e.stopPropagation();
 onEdit(note);
 }}
 >
 <Edit className="w-4 h-4" />
 </Button>
 </div>
 </div>
 </AccordionTrigger>
 <AccordionContent className="px-4 pb-4">
 <div className="grid gap-4">
 {/* Subjective */}
 <div className="p-4 rounded-lg bg-info/10 /20">
 <h4 className="font-semibold text-info mb-2">
 Subjective
 </h4>
 <div className="space-y-2 text-sm">
 <p>
 <strong>Chief Complaint:</strong> {note.subjective_chief_complaint}
 </p>
 {note.subjective_duration && (
 <p>
 <strong>Duration:</strong> {note.subjective_duration}
 </p>
 )}
 {note.subjective_history && (
 <p>
 <strong>History:</strong> {note.subjective_history}
 </p>
 )}
 {note.subjective_owner_observations && (
 <p>
 <strong>Owner Observations:</strong> {note.subjective_owner_observations}
 </p>
 )}
 </div>
 </div>

 {/* Objective */}
 <div className="p-4 rounded-lg bg-success/10 /20">
 <h4 className="font-semibold text-success mb-2">
 Objective
 </h4>
 <div className="space-y-2 text-sm">
 <div className="flex flex-wrap gap-4">
 {note.objective_temperature && (
 <span>
 <strong>Temp:</strong> {note.objective_temperature}°F
 </span>
 )}
 {note.objective_weight && (
 <span>
 <strong>Weight:</strong> {note.objective_weight} lbs
 </span>
 )}
 {note.objective_heart_rate && (
 <span>
 <strong>HR:</strong> {note.objective_heart_rate} bpm
 </span>
 )}
 {note.objective_respiratory_rate && (
 <span>
 <strong>RR:</strong> {note.objective_respiratory_rate}/min
 </span>
 )}
 {note.objective_body_condition_score && (
 <span>
 <strong>BCS:</strong> {note.objective_body_condition_score}/9
 </span>
 )}
 </div>
 <p>
 <strong>Physical Exam:</strong> {note.objective_physical_exam}
 </p>
 {note.objective_findings && (
 <p>
 <strong>Additional Findings:</strong> {note.objective_findings}
 </p>
 )}
 </div>
 </div>

 {/* Assessment */}
 <div className="p-4 rounded-lg bg-primary/10 /20">
 <h4 className="font-semibold text-primary mb-2">
 Assessment
 </h4>
 <div className="space-y-2 text-sm">
 <p>
 <strong>Primary Diagnosis:</strong> {note.assessment_primary_diagnosis}
 </p>
 {note.assessment_differential_diagnoses &&
 note.assessment_differential_diagnoses.length > 0 && (
 <p>
 <strong>Differential:</strong>{""}
 {note.assessment_differential_diagnoses.join(",")}
 </p>
 )}
 {note.assessment_prognosis && (
 <p>
 <strong>Prognosis:</strong>{""}
 <Badge variant="outline" className="capitalize">
 {note.assessment_prognosis}
 </Badge>
 </p>
 )}
 </div>
 </div>

 {/* Plan */}
 <div className="p-4 rounded-lg bg-warning/10 /20">
 <h4 className="font-semibold text-warning mb-2">
 Plan
 </h4>
 <div className="space-y-2 text-sm">
 <p>
 <strong>Treatment:</strong> {note.plan_treatment}
 </p>
 {note.plan_medications && (
 <p>
 <strong>Medications:</strong> {note.plan_medications}
 </p>
 )}
 {note.plan_follow_up && (
 <p>
 <strong>Follow-up:</strong> {note.plan_follow_up}
 </p>
 )}
 {note.plan_client_education && (
 <p>
 <strong>Client Education:</strong> {note.plan_client_education}
 </p>
 )}
 {note.plan_referral && (
 <p>
 <strong>Referral:</strong> {note.plan_referral}
 </p>
 )}
 </div>
 </div>

 {/* Metadata */}
 {(note.finalized_at || note.amended_at) && (
 <div className="text-xs text-muted-foreground border-t pt-2">
 {note.finalized_at && (
 <p>Finalized: {format(new Date(note.finalized_at),"MMM d, yyyy h:mm a")}</p>
 )}
 {note.amended_at && (
 <p>
 Amended: {format(new Date(note.amended_at),"MMM d, yyyy h:mm a")}
 {note.amendment_reason && ` - ${note.amendment_reason}`}
 </p>
 )}
 </div>
 )}
 </div>
 </AccordionContent>
 </AccordionItem>
 </Accordion>
 </Card>
 ))}
 </div>
 );
};
