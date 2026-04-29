import { useState, useEffect } from"react";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import { Label } from"@/components/ui/label";
import { Checkbox } from"@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from"@/components/ui/radio-group";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import { ClipboardList } from"lucide-react";

interface IntakeAnswer {
 question_id: string;
 answer_text: string;
}

interface IntakeQuestionsFormProps {
 merchantId: string;
 serviceId: string | null;
 answers: IntakeAnswer[];
 onAnswersChange: (answers: IntakeAnswer[]) => void;
}

export function IntakeQuestionsForm({
 merchantId,
 serviceId,
 answers,
 onAnswersChange,
}: IntakeQuestionsFormProps) {
 const { data: questions = [] } = useQuery({
 queryKey: ["intake-questions", merchantId, serviceId],
 queryFn: async () => {
 let query = supabase
 .from("booking_intake_questions")
 .select("*")
 .eq("merchant_id", merchantId)
 .eq("is_active", true)
 .order("display_order");

 // Get questions for this specific service + global (null service_id)
 if (serviceId) {
 query = query.or(`service_id.eq.${serviceId},service_id.is.null`);
 } else {
 query = query.is("service_id", null);
 }

 const { data, error } = await query;
 if (error) throw error;
 return data || [];
 },
 enabled: !!merchantId,
 });

 useEffect(() => {
 // Initialize answers for new questions
 if (questions.length > 0 && answers.length === 0) {
 onAnswersChange(questions.map((q) => ({ question_id: q.id, answer_text:"" })));
 }
 }, [questions]);

 if (questions.length === 0) return null;

 const updateAnswer = (questionId: string, value: string) => {
 const updated = answers.map((a) =>
 a.question_id === questionId ? { ...a, answer_text: value } : a
 );
 // If not found, add
 if (!updated.find((a) => a.question_id === questionId)) {
 updated.push({ question_id: questionId, answer_text: value });
 }
 onAnswersChange(updated);
 };

 const getAnswer = (questionId: string) =>
 answers.find((a) => a.question_id === questionId)?.answer_text ||"";

 return (
 <div className="space-y-4">
 <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
 <ClipboardList className="w-4 h-4" />
 Additional Information
 </h4>
 {questions.map((q) => {
 const options = (q.options as string[]) || [];
 return (
 <div key={q.id} className="space-y-1.5">
 <Label className="text-sm">
 {q.question_text}
 {q.is_required && <span className="text-destructive ml-1">*</span>}
 </Label>

 {q.question_type ==="text" && (
 <Input
 value={getAnswer(q.id)}
 onChange={(e) => updateAnswer(q.id, e.target.value)}
 placeholder="Your answer..."
 />
 )}

 {q.question_type ==="textarea" && (
 <Textarea
 value={getAnswer(q.id)}
 onChange={(e) => updateAnswer(q.id, e.target.value)}
 placeholder="Your answer..."
 rows={2}
 />
 )}

 {q.question_type ==="select" && (
 <Select
 value={getAnswer(q.id)}
 onValueChange={(v) => updateAnswer(q.id, v)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select..." />
 </SelectTrigger>
 <SelectContent>
 {options.map((opt) => (
 <SelectItem key={opt} value={opt}>
 {opt}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 )}

 {q.question_type ==="radio" && (
 <RadioGroup
 value={getAnswer(q.id)}
 onValueChange={(v) => updateAnswer(q.id, v)}
 >
 {options.map((opt) => (
 <div key={opt} className="flex items-center space-x-2">
 <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
 <Label htmlFor={`${q.id}-${opt}`} className="font-normal text-sm">
 {opt}
 </Label>
 </div>
 ))}
 </RadioGroup>
 )}

 {q.question_type ==="checkbox" && (
 <div className="space-y-2">
 {options.map((opt) => {
 const currentAnswer = getAnswer(q.id);
 const selected = currentAnswer ? currentAnswer.split("||") : [];
 const isChecked = selected.includes(opt);
 return (
 <div key={opt} className="flex items-center space-x-2">
 <Checkbox
 id={`${q.id}-${opt}`}
 checked={isChecked}
 onCheckedChange={(checked) => {
 const newSelected = checked
 ? [...selected, opt]
 : selected.filter((s) => s !== opt);
 updateAnswer(q.id, newSelected.join("||"));
 }}
 />
 <Label htmlFor={`${q.id}-${opt}`} className="font-normal text-sm">
 {opt}
 </Label>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 })}
 </div>
 );
}
