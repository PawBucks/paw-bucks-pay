import { useState, useRef, useCallback, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { Textarea } from"@/components/ui/textarea";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from"@/components/ui/select";
import {
 Mic,
 MicOff,
 Loader2,
 Sparkles,
 CheckCircle,
 AlertCircle,
 Copy,
 FileText,
 Thermometer,
 Scale,
 Heart,
 Wind,
} from"lucide-react";
import { toast } from"sonner";
import { useQuery } from"@tanstack/react-query";

interface AutoSOAPGeneratorProps {
 vetId: string;
}

export const AutoSOAPGenerator = ({ vetId }: AutoSOAPGeneratorProps) => {
 const [isRecording, setIsRecording] = useState(false);
 const [transcription, setTranscription] = useState("");
 const [selectedPetId, setSelectedPetId] = useState<string>("");
 const [currentDraft, setCurrentDraft] = useState<any>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [recordingTime, setRecordingTime] = useState(0);
 
 const mediaRecorderRef = useRef<MediaRecorder | null>(null);
 const audioChunksRef = useRef<Blob[]>([]);
 const timerRef = useRef<NodeJS.Timeout | null>(null);
 const recognitionRef = useRef<any>(null);

 // Fetch vet's patients
 const { data: patients } = useQuery({
 queryKey: ["vet-patients-soap", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("pet_profiles")
 .select(`
 id,
 name,
 type,
 breed,
 birthday
 `)
 .order("name");

 if (error) throw error;
 return (data || []) as any[];
 },
 });

 // Fetch recent drafts
 const { data: recentDrafts, refetch: refetchDrafts } = useQuery({
 queryKey: ["soap-drafts", vetId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from("ai_soap_drafts")
 .select(`
 *,
 pet:pet_profiles(name, species)
 `)
 .eq("vet_id", vetId)
 .in("status", ["ready","generating","transcribing"])
 .order("created_at", { ascending: false })
 .limit(5);

 if (error) throw error;
 return data || [];
 },
 });

 // Initialize speech recognition
 useEffect(() => {
 if (typeof window !=="undefined" && ("SpeechRecognition" in window ||"webkitSpeechRecognition" in window)) {
 const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
 recognitionRef.current = new SpeechRecognition();
 recognitionRef.current.continuous = true;
 recognitionRef.current.interimResults = true;
 recognitionRef.current.lang ="en-US";

 recognitionRef.current.onresult = (event: any) => {
 let finalTranscript ="";
 let interimTranscript ="";

 for (let i = event.resultIndex; i < event.results.length; i++) {
 const transcript = event.results[i][0].transcript;
 if (event.results[i].isFinal) {
 finalTranscript += transcript +"";
 } else {
 interimTranscript += transcript;
 }
 }

 if (finalTranscript) {
 setTranscription((prev) => prev + finalTranscript);
 }
 };

 recognitionRef.current.onerror = (event: any) => {
 console.error("Speech recognition error:", event.error);
 if (event.error !=="no-speech") {
 toast.error("Speech recognition error. Please try again.");
 }
 };
 }

 return () => {
 if (recognitionRef.current) {
 recognitionRef.current.stop();
 }
 };
 }, []);

 const startRecording = useCallback(async () => {
 if (!selectedPetId) {
 toast.error("Please select a patient first");
 return;
 }

 try {
 // Create a new draft record
 const { data: draft, error: draftError } = await supabase
 .from("ai_soap_drafts")
 .insert({
 pet_id: selectedPetId,
 vet_id: vetId,
 status:"recording",
 })
 .select()
 .single();

 if (draftError) throw draftError;
 setCurrentDraft(draft);

 // Start speech recognition
 if (recognitionRef.current) {
 recognitionRef.current.start();
 }

 setIsRecording(true);
 setRecordingTime(0);
 setTranscription("");

 // Start timer
 timerRef.current = setInterval(() => {
 setRecordingTime((prev) => prev + 1);
 }, 1000);

 toast.success("Recording started. Speak clearly about the examination.");
 } catch (error: any) {
 console.error("Error starting recording:", error);
 toast.error("Failed to start recording");
 }
 }, [selectedPetId, vetId]);

 const stopRecording = useCallback(async () => {
 setIsRecording(false);

 if (timerRef.current) {
 clearInterval(timerRef.current);
 }

 if (recognitionRef.current) {
 recognitionRef.current.stop();
 }

 if (!currentDraft || !transcription.trim()) {
 toast.error("No transcription captured. Please try again.");
 return;
 }

 // Update draft with transcription
 await supabase
 .from("ai_soap_drafts")
 .update({
 transcription,
 audio_duration_seconds: recordingTime,
 status:"transcribing",
 })
 .eq("id", currentDraft.id);

 refetchDrafts();
 }, [currentDraft, transcription, recordingTime, refetchDrafts]);

 const processWithAI = useCallback(async (draftId: string) => {
 setIsProcessing(true);

 try {
 const draft = recentDrafts?.find((d) => d.id === draftId);
 const pet = patients?.find((p) => p.id === draft?.pet_id);

 const { data, error } = await supabase.functions.invoke("ai-transcribe-soap", {
 body: {
 draft_id: draftId,
 transcription: draft?.transcription,
 pet_name: pet?.name,
 pet_species: pet?.type,
 pet_breed: pet?.breed,
 pet_age: pet?.birthday
 ? calculateAge(pet.birthday)
 : undefined,
 },
 });

 if (error) throw error;

 toast.success("SOAP note generated successfully!");
 refetchDrafts();
 } catch (error: any) {
 console.error("Error processing with AI:", error);
 toast.error(error.message ||"Failed to generate SOAP note");
 } finally {
 setIsProcessing(false);
 }
 }, [recentDrafts, patients, refetchDrafts]);

 const calculateAge = (dateOfBirth: string): string => {
 const birth = new Date(dateOfBirth);
 const now = new Date();
 const years = Math.floor(
 (now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
 );
 return `${years} years`;
 };

 const formatTime = (seconds: number): string => {
 const mins = Math.floor(seconds / 60);
 const secs = seconds % 60;
 return `${mins}:${secs.toString().padStart(2,"0")}`;
 };

 const copyToClipboard = (text: string) => {
 navigator.clipboard.writeText(text);
 toast.success("Copied to clipboard");
 };

 const selectedPet = patients?.find((p) => p.id === selectedPetId);

 return (
 <div className="space-y-6">
 {/* Recording Section */}
 <Card className="p-6">
 <div className="flex items-center gap-3 mb-6">
 <div className="w-10 h-10 rounded-full bg-info/10 /30 flex items-center justify-center">
 <Mic className="w-5 h-5 text-info" />
 </div>
 <div>
 <h3 className="text-lg font-semibold">Voice-to-SOAP Generator</h3>
 <p className="text-sm text-muted-foreground">
 Record your examination and let AI draft the SOAP note
 </p>
 </div>
 </div>

 <div className="space-y-4">
 <div className="flex gap-4">
 <Select value={selectedPetId} onValueChange={setSelectedPetId}>
 <SelectTrigger className="flex-1">
 <SelectValue placeholder="Select patient..." />
 </SelectTrigger>
 <SelectContent>
 {patients?.map((pet) => (
 <SelectItem key={pet.id} value={pet.id}>
 {pet.name} ({pet.type} - {pet.breed})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 {!isRecording ? (
 <Button
 onClick={startRecording}
 disabled={!selectedPetId}
 className="bg-destructive hover:bg-destructive"
 >
 <Mic className="w-4 h-4 mr-2" />
 Start Recording
 </Button>
 ) : (
 <Button
 onClick={stopRecording}
 variant="outline"
 className="border-destructive text-destructive"
 >
 <MicOff className="w-4 h-4 mr-2" />
 Stop ({formatTime(recordingTime)})
 </Button>
 )}
 </div>

 {isRecording && (
 <div className="bg-destructive/10 /20 rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2">
 <span className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
 <span className="text-sm font-medium text-destructive">
 Recording in progress...
 </span>
 </div>
 <p className="text-xs text-muted-foreground">
 Speak clearly about the patient's history, symptoms, and your examination findings.
 </p>
 </div>
 )}

 {transcription && (
 <div>
 <label className="text-sm font-medium mb-2 block">
 Live Transcription
 </label>
 <Textarea
 value={transcription}
 onChange={(e) => setTranscription(e.target.value)}
 placeholder="Transcription will appear here..."
 rows={4}
 className="font-mono text-sm"
 />
 </div>
 )}
 </div>
 </Card>

 {/* Recent Drafts */}
 <Card className="p-6">
 <h3 className="text-lg font-semibold mb-4">Recent AI Drafts</h3>

 {recentDrafts && recentDrafts.length > 0 ? (
 <div className="space-y-4">
 {recentDrafts.map((draft: any) => (
 <div
 key={draft.id}
 className="border rounded-lg p-4 space-y-4"
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <FileText className="w-5 h-5 text-muted-foreground" />
 <div>
 <p className="font-medium">{draft.pet?.name}</p>
 <p className="text-xs text-muted-foreground">
 {new Date(draft.created_at).toLocaleString()}
 </p>
 </div>
 </div>
 <Badge
 variant={
 draft.status ==="ready"
 ?"default"
 : draft.status ==="generating"
 ?"secondary"
 :"outline"
 }
 >
 {draft.status}
 </Badge>
 </div>

 {draft.status ==="transcribing" && (
 <Button
 onClick={() => processWithAI(draft.id)}
 disabled={isProcessing}
 className="w-full"
 >
 {isProcessing ? (
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 ) : (
 <Sparkles className="w-4 h-4 mr-2" />
 )}
 Generate SOAP Note with AI
 </Button>
 )}

 {draft.status ==="generating" && (
 <div className="flex items-center justify-center py-4">
 <Loader2 className="w-6 h-6 animate-spin text-primary" />
 <span className="ml-2">AI is processing...</span>
 </div>
 )}

 {draft.status ==="ready" && (
 <div className="space-y-4">
 {/* Extracted Vitals */}
 {draft.extracted_vitals &&
 Object.keys(draft.extracted_vitals).some(
 (k) => draft.extracted_vitals[k]
 ) && (
 <div className="bg-muted/50 rounded-lg p-3">
 <p className="text-sm font-medium mb-2">
 Extracted Vitals
 </p>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
 {draft.extracted_vitals.temperature && (
 <div className="flex items-center gap-1 text-sm">
 <Thermometer className="w-3 h-3" />
 {draft.extracted_vitals.temperature}°F
 </div>
 )}
 {draft.extracted_vitals.weight && (
 <div className="flex items-center gap-1 text-sm">
 <Scale className="w-3 h-3" />
 {draft.extracted_vitals.weight} lbs
 </div>
 )}
 {draft.extracted_vitals.heart_rate && (
 <div className="flex items-center gap-1 text-sm">
 <Heart className="w-3 h-3" />
 {draft.extracted_vitals.heart_rate} bpm
 </div>
 )}
 {draft.extracted_vitals.respiratory_rate && (
 <div className="flex items-center gap-1 text-sm">
 <Wind className="w-3 h-3" />
 {draft.extracted_vitals.respiratory_rate}/min
 </div>
 )}
 </div>
 </div>
 )}

 {/* SOAP Sections */}
 <div className="grid gap-3">
 <div className="space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-info">
 Subjective
 </span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => copyToClipboard(draft.ai_subjective)}
 >
 <Copy className="w-3 h-3" />
 </Button>
 </div>
 <p className="text-sm bg-info/10 /20 rounded p-2">
 {draft.ai_subjective}
 </p>
 </div>

 <div className="space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-success">
 Objective
 </span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => copyToClipboard(draft.ai_objective)}
 >
 <Copy className="w-3 h-3" />
 </Button>
 </div>
 <p className="text-sm bg-success/10 /20 rounded p-2">
 {draft.ai_objective}
 </p>
 </div>

 <div className="space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-primary">
 Assessment (Suggested)
 </span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() =>
 copyToClipboard(draft.ai_suggested_assessment)
 }
 >
 <Copy className="w-3 h-3" />
 </Button>
 </div>
 <p className="text-sm bg-primary/10 /20 rounded p-2">
 {draft.ai_suggested_assessment}
 </p>
 </div>

 <div className="space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-warning">
 Plan (Suggested)
 </span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() =>
 copyToClipboard(draft.ai_suggested_plan)
 }
 >
 <Copy className="w-3 h-3" />
 </Button>
 </div>
 <p className="text-sm bg-warning/10 /20 rounded p-2">
 {draft.ai_suggested_plan}
 </p>
 </div>
 </div>

 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span>Model: {draft.model_used}</span>
 <span>
 Processed in {draft.processing_time_ms}ms
 </span>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 <Mic className="w-12 h-12 mx-auto mb-2 opacity-50" />
 <p>No recent drafts</p>
 <p className="text-sm">Start a recording to generate AI-assisted SOAP notes</p>
 </div>
 )}
 </Card>

 {/* Browser Support Note */}
 {typeof window !=="undefined" &&
 !("SpeechRecognition" in window) &&
 !("webkitSpeechRecognition" in window) && (
 <Card className="p-4 bg-warning/10 /20 border-warning/20">
 <div className="flex items-start gap-3">
 <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
 <div>
 <p className="font-medium text-warning">
 Limited Browser Support
 </p>
 <p className="text-sm text-warning">
 Voice-to-text works best in Chrome or Edge. You can still manually
 type or paste transcriptions.
 </p>
 </div>
 </div>
 </Card>
 )}
 </div>
 );
};
