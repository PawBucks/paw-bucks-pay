import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Badge } from"@/components/ui/badge";
import { ScrollArea } from"@/components/ui/scroll-area";
import { AlertTriangle, ArrowLeft, Calendar, FileText, FlaskConical, Image, Mail, Phone, Plus, Scissors, Syringe, User } from "lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";
import type { EMRPatient, SOAPNote, Vaccination, PetAllergy, SurgicalNote, LabResult, ImagingRecord } from"./types";
import { SOAPNoteEditor } from"./SOAPNoteEditor";
import { SOAPNotesList } from"./SOAPNotesList";
import { VaccinationsTab } from"./VaccinationsTab";
import { AllergiesTab } from"./AllergiesTab";
import { SurgicalNotesTab } from"./SurgicalNotesTab";
import { LabResultsTab } from"./LabResultsTab";
import { ImagingTab } from"./ImagingTab";
import { PawBucksLogo } from "@/components/PawBucksLogo";

interface PatientEMRViewProps {
 patient: EMRPatient;
 vetId: string;
 onBack: () => void;
}

export const PatientEMRView = ({ patient, vetId, onBack }: PatientEMRViewProps) => {
 const [activeTab, setActiveTab] = useState("soap");
 const [showSOAPEditor, setShowSOAPEditor] = useState(false);
 const [editingSOAP, setEditingSOAP] = useState<SOAPNote | null>(null);
 const [allergies, setAllergies] = useState<PetAllergy[]>([]);
 const [refreshTrigger, setRefreshTrigger] = useState(0);

 useEffect(() => {
 loadAllergies();
 }, [patient.pet_id]);

 const loadAllergies = async () => {
 const { data } = await supabase
 .from("pet_allergies")
 .select("*")
 .eq("pet_id", patient.pet_id)
 .eq("is_active", true);
 
 setAllergies((data as PetAllergy[]) || []);
 };

 const handleSOAPCreated = () => {
 setShowSOAPEditor(false);
 setEditingSOAP(null);
 setRefreshTrigger((prev) => prev + 1);
 toast.success("SOAP note saved successfully");
 };

 if (showSOAPEditor) {
 return (
 <SOAPNoteEditor
 petId={patient.pet_id}
 vetId={vetId}
 existingNote={editingSOAP}
 onSave={handleSOAPCreated}
 onCancel={() => {
 setShowSOAPEditor(false);
 setEditingSOAP(null);
 }}
 />
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-4">
 <Button variant="ghost" onClick={onBack}>
 <ArrowLeft className="w-4 h-4 mr-2" />
 Back
 </Button>
 <div>
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
 <PawBucksLogo className="w-6 h-6 text-primary" />
 </div>
 <div>
 <h2 className="text-2xl font-bold">{patient.pet_name}</h2>
 <p className="text-muted-foreground capitalize">
 {patient.pet_type}
 {patient.pet_breed && ` • ${patient.pet_breed}`}
 </p>
 </div>
 </div>
 </div>
 </div>
 {allergies.length > 0 && (
 <div className="flex items-center gap-2">
 <Badge variant="destructive" className="flex items-center gap-1">
 <AlertTriangle className="w-3 h-3" />
 {allergies.length} Known Allerg{allergies.length > 1 ?"ies" :"y"}
 </Badge>
 </div>
 )}
 </div>

 {/* Owner Info Card */}
 <Card className="p-4">
 <div className="flex items-center gap-6">
 <div className="flex items-center gap-2">
 <User className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
 <span className="font-medium">{patient.owner_name}</span>
 </div>
 {patient.owner_email && (
 <div className="flex items-center gap-2">
 <Mail className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
 <span className="text-sm">{patient.owner_email}</span>
 </div>
 )}
 {patient.owner_phone && (
 <div className="flex items-center gap-2">
 <Phone className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
 <span className="text-sm">{patient.owner_phone}</span>
 </div>
 )}
 {patient.last_visit && (
 <div className="flex items-center gap-2">
 <Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
 <span className="text-sm">
 Last Visit: {format(new Date(patient.last_visit),"MMM d, yyyy")}
 </span>
 </div>
 )}
 </div>
 </Card>

 {/* Allergy Alert Bar */}
 {allergies.length > 0 && (
 <Card className="p-3 bg-destructive/10 border-destructive/20">
 <div className="flex items-center gap-2 flex-wrap">
 <AlertTriangle className="w-4 h-4 text-destructive" />
 <span className="font-medium text-destructive text-sm">Allergies:</span>
 {allergies.map((allergy) => (
 <Badge key={allergy.id} variant="outline" className="border-destructive text-destructive">
 {allergy.allergy_name} ({allergy.severity})
 </Badge>
 ))}
 </div>
 </Card>
 )}

 {/* EMR Tabs */}
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="grid w-full grid-cols-6">
 <TabsTrigger value="soap" className="flex items-center gap-1">
 <FileText className="w-4 h-4" aria-hidden="true" />
 <span className="hidden sm:inline">SOAP Notes</span>
 </TabsTrigger>
 <TabsTrigger value="vaccines" className="flex items-center gap-1">
 <Syringe className="w-4 h-4" />
 <span className="hidden sm:inline">Vaccines</span>
 </TabsTrigger>
 <TabsTrigger value="allergies" className="flex items-center gap-1">
 <AlertTriangle className="w-4 h-4" />
 <span className="hidden sm:inline">Allergies</span>
 </TabsTrigger>
 <TabsTrigger value="surgical" className="flex items-center gap-1">
 <Scissors className="w-4 h-4" aria-hidden="true" />
 <span className="hidden sm:inline">Surgical</span>
 </TabsTrigger>
 <TabsTrigger value="labs" className="flex items-center gap-1">
 <FlaskConical className="w-4 h-4" />
 <span className="hidden sm:inline">Labs</span>
 </TabsTrigger>
 <TabsTrigger value="imaging" className="flex items-center gap-1">
 <Image className="w-4 h-4" aria-hidden="true" />
 <span className="hidden sm:inline">Imaging</span>
 </TabsTrigger>
 </TabsList>

 <TabsContent value="soap" className="mt-4">
 <div className="flex justify-end mb-4">
 <Button onClick={() => setShowSOAPEditor(true)}>
 <Plus className="w-4 h-4 mr-2" />
 New SOAP Note
 </Button>
 </div>
 <SOAPNotesList
 petId={patient.pet_id}
 vetId={vetId}
 refreshTrigger={refreshTrigger}
 onEdit={(note) => {
 setEditingSOAP(note);
 setShowSOAPEditor(true);
 }}
 />
 </TabsContent>

 <TabsContent value="vaccines" className="mt-4">
 <VaccinationsTab petId={patient.pet_id} vetId={vetId} />
 </TabsContent>

 <TabsContent value="allergies" className="mt-4">
 <AllergiesTab
 petId={patient.pet_id}
 vetId={vetId}
 onUpdate={loadAllergies}
 />
 </TabsContent>

 <TabsContent value="surgical" className="mt-4">
 <SurgicalNotesTab petId={patient.pet_id} vetId={vetId} />
 </TabsContent>

 <TabsContent value="labs" className="mt-4">
 <LabResultsTab petId={patient.pet_id} vetId={vetId} />
 </TabsContent>

 <TabsContent value="imaging" className="mt-4">
 <ImagingTab petId={patient.pet_id} vetId={vetId} />
 </TabsContent>
 </Tabs>
 </div>
 );
};
