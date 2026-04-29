import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Switch } from"@/components/ui/switch";
import { Badge } from"@/components/ui/badge";
import { GradientCard } from"@/components/ui/gradient-card";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from"@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { Plus, Edit, Trash2, GripVertical, ClipboardList } from"lucide-react";
import { toast } from"sonner";

interface IntakeQuestionsManagerProps {
 merchantId: string;
 services: { id: string; name: string }[];
}

const QUESTION_TYPES = [
 { value:"text", label:"Short Text" },
 { value:"textarea", label:"Long Text" },
 { value:"select", label:"Dropdown" },
 { value:"radio", label:"Radio Buttons" },
 { value:"checkbox", label:"Checkboxes" },
];

export function IntakeQuestionsManager({ merchantId, services }: IntakeQuestionsManagerProps) {
 const queryClient = useQueryClient();
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editing, setEditing] = useState<any>(null);
 const [questionText, setQuestionText] = useState("");
 const [questionType, setQuestionType] = useState("text");
 const [serviceId, setServiceId] = useState<string>("all");
 const [isRequired, setIsRequired] = useState(false);
 const [options, setOptions] = useState<string[]>([""]);

 const { data: questions = [], isLoading } = useQuery({
 queryKey: ["intake-questions-manage", merchantId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("booking_intake_questions")
 .select("*")
 .eq("merchant_id", merchantId)
 .order("display_order");
 if (error) throw error;
 return data || [];
 },
 });

 const saveMutation = useMutation({
 mutationFn: async () => {
 const payload = {
 merchant_id: merchantId,
 service_id: serviceId ==="all" ? null : serviceId,
 question_text: questionText,
 question_type: questionType,
 is_required: isRequired,
 options: ["select","radio","checkbox"].includes(questionType)
 ? options.filter((o) => o.trim())
 : null,
 display_order: editing ? editing.display_order : questions.length,
 };

 if (editing) {
 const { error } = await supabase
 .from("booking_intake_questions")
 .update(payload)
 .eq("id", editing.id);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from("booking_intake_questions")
 .insert(payload);
 if (error) throw error;
 }
 },
 onSuccess: () => {
 toast.success(editing ?"Question updated" :"Question added");
 queryClient.invalidateQueries({ queryKey: ["intake-questions-manage"] });
 resetForm();
 },
 onError: () => toast.error("Failed to save question"),
 });

 const deleteMutation = useMutation({
 mutationFn: async (id: string) => {
 const { error } = await supabase
 .from("booking_intake_questions")
 .delete()
 .eq("id", id);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success("Question deleted");
 queryClient.invalidateQueries({ queryKey: ["intake-questions-manage"] });
 },
 });

 const toggleMutation = useMutation({
 mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
 const { error } = await supabase
 .from("booking_intake_questions")
 .update({ is_active: active })
 .eq("id", id);
 if (error) throw error;
 },
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ["intake-questions-manage"] }),
 });

 const resetForm = () => {
 setDialogOpen(false);
 setEditing(null);
 setQuestionText("");
 setQuestionType("text");
 setServiceId("all");
 setIsRequired(false);
 setOptions([""]);
 };

 const openEdit = (q: any) => {
 setEditing(q);
 setQuestionText(q.question_text);
 setQuestionType(q.question_type);
 setServiceId(q.service_id ||"all");
 setIsRequired(q.is_required);
 setOptions((q.options as string[]) || [""]);
 setDialogOpen(true);
 };

 const hasOptions = ["select","radio","checkbox"].includes(questionType);

 return (
 <GradientCard className="p-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold flex items-center gap-2">
 <ClipboardList className="w-4 h-4" />
 Intake Questions
 </h3>
 <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
 <Plus className="w-4 h-4 mr-1" /> Add Question
 </Button>
 </div>

 {questions.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-4">
 No intake questions yet. Add questions customers must answer when booking.
 </p>
 ) : (
 <div className="space-y-2">
 {questions.map((q) => (
 <div key={q.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 gap-3">
 <div className="flex-1 min-w-0">
 <p className="font-medium text-sm truncate">{q.question_text}</p>
 <div className="flex items-center gap-2 mt-1">
 <Badge variant="outline" className="text-xs">{q.question_type}</Badge>
 {q.is_required && <Badge variant="destructive" className="text-xs">Required</Badge>}
 {q.service_id && (
 <Badge variant="secondary" className="text-xs">
 {services.find((s) => s.id === q.service_id)?.name ||"Specific service"}
 </Badge>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 <Switch
 checked={q.is_active}
 onCheckedChange={(checked) => toggleMutation.mutate({ id: q.id, active: checked })}
 />
 <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(q)}>
 <Edit className="w-3.5 h-3.5" />
 </Button>
 <Button
 size="icon"
 variant="ghost"
 className="h-8 w-8 text-destructive"
 onClick={() => deleteMutation.mutate(q.id)}
 >
 <Trash2 className="w-3.5 h-3.5" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 )}

 <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>{editing ?"Edit Question" :"Add Intake Question"}</DialogTitle>
 </DialogHeader>

 <div className="space-y-4">
 <div>
 <Label>Question Text</Label>
 <Input
 value={questionText}
 onChange={(e) => setQuestionText(e.target.value)}
 placeholder="e.g., Does your pet have any allergies?"
 />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Type</Label>
 <Select value={questionType} onValueChange={setQuestionType}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {QUESTION_TYPES.map((t) => (
 <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Applies To</Label>
 <Select value={serviceId} onValueChange={setServiceId}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Services</SelectItem>
 {services.map((s) => (
 <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 {hasOptions && (
 <div>
 <Label>Options</Label>
 <div className="space-y-2">
 {options.map((opt, i) => (
 <div key={i} className="flex gap-2">
 <Input
 value={opt}
 onChange={(e) => {
 const updated = [...options];
 updated[i] = e.target.value;
 setOptions(updated);
 }}
 placeholder={`Option ${i + 1}`}
 />
 {options.length > 1 && (
 <Button
 variant="ghost"
 size="icon"
 onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 )}
 </div>
 ))}
 <Button
 variant="outline"
 size="sm"
 onClick={() => setOptions([...options,""])}
 >
 <Plus className="w-3 h-3 mr-1" /> Add Option
 </Button>
 </div>
 </div>
 )}

 <div className="flex items-center justify-between rounded-lg border p-3">
 <Label>Required</Label>
 <Switch checked={isRequired} onCheckedChange={setIsRequired} />
 </div>
 </div>

 <DialogFooter>
 <Button variant="outline" onClick={resetForm}>Cancel</Button>
 <Button
 onClick={() => saveMutation.mutate()}
 disabled={!questionText.trim() || saveMutation.isPending}
 >
 {saveMutation.isPending ?"Saving..." : editing ?"Update" :"Add"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </GradientCard>
 );
}
