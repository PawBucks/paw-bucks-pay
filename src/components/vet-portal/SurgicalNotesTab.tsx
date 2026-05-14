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
import {
 Accordion,
 AccordionContent,
 AccordionItem,
 AccordionTrigger,
} from"@/components/ui/accordion";
import { AlertCircle, Calendar, CheckCircle, Loader2, Plus, Scissors } from "lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";
import type { SurgicalNote } from"./types";

interface SurgicalNotesTabProps {
 petId: string;
 vetId: string;
}

export const SurgicalNotesTab = ({ petId, vetId }: SurgicalNotesTabProps) => {
 const [notes, setNotes] = useState<SurgicalNote[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [formData, setFormData] = useState({
 surgery_date: new Date().toISOString().slice(0, 16),
 procedure_name:"",
 procedure_code:"",
 anesthesia_type:"",
 anesthesia_duration_minutes:"",
 pre_op_notes:"",
 operative_notes:"",
 post_op_notes:"",
 complications:"",
 outcome:"successful",
 follow_up_required: true,
 follow_up_date:"",
 });

 useEffect(() => {
 loadNotes();
 }, [petId]);

 const loadNotes = async () => {
 try {
 const { data, error } = await supabase
 .from("pet_surgical_notes")
 .select("*")
 .eq("pet_id", petId)
 .order("surgery_date", { ascending: false });

 if (error) throw error;
 setNotes((data as SurgicalNote[]) || []);
 } catch (error) {
 console.error("Error loading surgical notes:", error);
 } finally {
 setIsLoading(false);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.procedure_name || !formData.operative_notes) {
 toast.error("Please fill in required fields");
 return;
 }

 setIsSubmitting(true);
 try {
 const { error } = await supabase.from("pet_surgical_notes").insert({
 pet_id: petId,
 vet_id: vetId,
 surgery_date: formData.surgery_date,
 procedure_name: formData.procedure_name,
 procedure_code: formData.procedure_code || null,
 anesthesia_type: formData.anesthesia_type || null,
 anesthesia_duration_minutes: formData.anesthesia_duration_minutes
 ? parseInt(formData.anesthesia_duration_minutes)
 : null,
 pre_op_notes: formData.pre_op_notes || null,
 operative_notes: formData.operative_notes,
 post_op_notes: formData.post_op_notes || null,
 complications: formData.complications || null,
 outcome: formData.outcome,
 follow_up_required: formData.follow_up_required,
 follow_up_date: formData.follow_up_date || null,
 });

 if (error) throw error;
 toast.success("Surgical note saved");
 setDialogOpen(false);
 loadNotes();
 setFormData({
 surgery_date: new Date().toISOString().slice(0, 16),
 procedure_name:"",
 procedure_code:"",
 anesthesia_type:"",
 anesthesia_duration_minutes:"",
 pre_op_notes:"",
 operative_notes:"",
 post_op_notes:"",
 complications:"",
 outcome:"successful",
 follow_up_required: true,
 follow_up_date:"",
 });
 } catch (error: any) {
 console.error("Error saving surgical note:", error);
 toast.error(error.message ||"Failed to save surgical note");
 } finally {
 setIsSubmitting(false);
 }
 };

 const getOutcomeIcon = (outcome: string) => {
 switch (outcome) {
 case"successful":
 return <CheckCircle className="w-4 h-4 text-success" />;
 case"complications":
 return <AlertCircle className="w-4 h-4 text-warning" />;
 default:
 return <AlertCircle className="w-4 h-4 text-destructive" />;
 }
 };

 if (isLoading) {
 return <div className="text-center py-8 text-muted-foreground">Loading surgical notes...</div>;
 }

 return (
 <div className="space-y-4">
 <div className="flex justify-end">
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogTrigger asChild>
 <Button>
 <Plus className="w-4 h-4 mr-2" />
 Add Surgical Note
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Add Surgical Note</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="procedure_name">Procedure Name *</Label>
 <Input
 id="procedure_name"
 value={formData.procedure_name}
 onChange={(e) => setFormData({ ...formData, procedure_name: e.target.value })}
 placeholder="e.g., Spay, Neuter, Mass Removal"
 />
 </div>
 <div>
 <Label htmlFor="procedure_code">Procedure Code</Label>
 <Input
 id="procedure_code"
 value={formData.procedure_code}
 onChange={(e) => setFormData({ ...formData, procedure_code: e.target.value })}
 placeholder="Optional"
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="surgery_date">Surgery Date/Time *</Label>
 <Input
 id="surgery_date"
 type="datetime-local"
 value={formData.surgery_date}
 onChange={(e) => setFormData({ ...formData, surgery_date: e.target.value })}
 />
 </div>
 <div>
 <Label htmlFor="outcome">Outcome</Label>
 <Select
 value={formData.outcome}
 onValueChange={(value) => setFormData({ ...formData, outcome: value })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="successful">Successful</SelectItem>
 <SelectItem value="complications">Complications</SelectItem>
 <SelectItem value="unsuccessful">Unsuccessful</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label htmlFor="anesthesia_type">Anesthesia Type</Label>
 <Input
 id="anesthesia_type"
 value={formData.anesthesia_type}
 onChange={(e) => setFormData({ ...formData, anesthesia_type: e.target.value })}
 placeholder="e.g., General, Local, Sedation"
 />
 </div>
 <div>
 <Label htmlFor="anesthesia_duration">Anesthesia Duration (min)</Label>
 <Input
 id="anesthesia_duration"
 type="number"
 value={formData.anesthesia_duration_minutes}
 onChange={(e) => setFormData({ ...formData, anesthesia_duration_minutes: e.target.value })}
 />
 </div>
 </div>
 <div>
 <Label htmlFor="pre_op_notes">Pre-Operative Notes</Label>
 <Textarea
 id="pre_op_notes"
 value={formData.pre_op_notes}
 onChange={(e) => setFormData({ ...formData, pre_op_notes: e.target.value })}
 placeholder="Pre-surgical assessment, bloodwork results, fasting status..."
 rows={2}
 />
 </div>
 <div>
 <Label htmlFor="operative_notes">Operative Notes *</Label>
 <Textarea
 id="operative_notes"
 value={formData.operative_notes}
 onChange={(e) => setFormData({ ...formData, operative_notes: e.target.value })}
 placeholder="Detailed description of the surgical procedure..."
 rows={4}
 />
 </div>
 <div>
 <Label htmlFor="post_op_notes">Post-Operative Notes</Label>
 <Textarea
 id="post_op_notes"
 value={formData.post_op_notes}
 onChange={(e) => setFormData({ ...formData, post_op_notes: e.target.value })}
 placeholder="Recovery notes, pain management, discharge instructions..."
 rows={2}
 />
 </div>
 <div>
 <Label htmlFor="complications">Complications</Label>
 <Textarea
 id="complications"
 value={formData.complications}
 onChange={(e) => setFormData({ ...formData, complications: e.target.value })}
 placeholder="Any intra or post-operative complications..."
 rows={2}
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="follow_up_required"
 checked={formData.follow_up_required}
 onChange={(e) => setFormData({ ...formData, follow_up_required: e.target.checked })}
 className="rounded"
 />
 <Label htmlFor="follow_up_required">Follow-up Required</Label>
 </div>
 {formData.follow_up_required && (
 <div>
 <Label htmlFor="follow_up_date">Follow-up Date</Label>
 <Input
 id="follow_up_date"
 type="date"
 value={formData.follow_up_date}
 onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
 />
 </div>
 )}
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

 {notes.length === 0 ? (
 <Card className="p-8 text-center text-muted-foreground">
 <Scissors className="w-12 h-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
 <p>No surgical notes recorded.</p>
 </Card>
 ) : (
 <div className="space-y-4">
 {notes.map((note) => (
 <Card key={note.id} className="overflow-hidden">
 <Accordion type="single" collapsible>
 <AccordionItem value={note.id} className="border-none">
 <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent">
 <div className="flex items-center justify-between w-full pr-4">
 <div className="flex items-center gap-3">
 {getOutcomeIcon(note.outcome)}
 <div className="text-left">
 <p className="font-semibold">{note.procedure_name}</p>
 <p className="text-sm text-muted-foreground">
 {format(new Date(note.surgery_date),"MMMM d, yyyy'at' h:mm a")}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Badge
 variant={
 note.outcome ==="successful"
 ?"default"
 : note.outcome ==="complications"
 ?"outline"
 :"destructive"
 }
 className="capitalize"
 >
 {note.outcome}
 </Badge>
 {note.follow_up_required && note.follow_up_date && (
 <Badge variant="secondary" className="flex items-center gap-1">
 <Calendar className="w-3 h-3" aria-hidden="true" />
 {format(new Date(note.follow_up_date),"MMM d")}
 </Badge>
 )}
 </div>
 </div>
 </AccordionTrigger>
 <AccordionContent className="px-4 pb-4">
 <div className="space-y-4">
 {note.anesthesia_type && (
 <div>
 <strong>Anesthesia:</strong> {note.anesthesia_type}
 {note.anesthesia_duration_minutes &&
 ` (${note.anesthesia_duration_minutes} min)`}
 </div>
 )}
 {note.pre_op_notes && (
 <div>
 <strong>Pre-Op Notes:</strong>
 <p className="text-sm mt-1">{note.pre_op_notes}</p>
 </div>
 )}
 <div>
 <strong>Operative Notes:</strong>
 <p className="text-sm mt-1">{note.operative_notes}</p>
 </div>
 {note.post_op_notes && (
 <div>
 <strong>Post-Op Notes:</strong>
 <p className="text-sm mt-1">{note.post_op_notes}</p>
 </div>
 )}
 {note.complications && (
 <div className="p-3 rounded-lg bg-warning/10 /20">
 <strong className="text-warning">Complications:</strong>
 <p className="text-sm mt-1">{note.complications}</p>
 </div>
 )}
 </div>
 </AccordionContent>
 </AccordionItem>
 </Accordion>
 </Card>
 ))}
 </div>
 )}
 </div>
 );
};
