import { useState, useEffect } from"react";
import { supabase } from"@/integrations/supabase/client";
import { Card } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Badge } from"@/components/ui/badge";
import { ScrollArea } from"@/components/ui/scroll-area";
import {
 Search,
 User,
 FileText,
 Syringe,
 AlertTriangle,
 Scissors,
 FlaskConical,
 ImageIcon,
 Clock,
 PawPrint,
} from"lucide-react";
import { toast } from"sonner";
import { format } from"date-fns";
import type { EMRPatient, SOAPNote, Vaccination, PetAllergy, SurgicalNote, LabResult, ImagingRecord } from"./types";
import { PatientEMRView } from"./PatientEMRView";

interface EMRDashboardProps {
 vetId: string;
}

export const EMRDashboard = ({ vetId }: EMRDashboardProps) => {
 const [patients, setPatients] = useState<EMRPatient[]>([]);
 const [selectedPatient, setSelectedPatient] = useState<EMRPatient | null>(null);
 const [searchQuery, setSearchQuery] = useState("");
 const [isLoading, setIsLoading] = useState(true);
 const [recentActivity, setRecentActivity] = useState<any[]>([]);

 useEffect(() => {
 loadPatients();
 loadRecentActivity();
 }, [vetId]);

 const loadPatients = async () => {
 try {
 // Get unique patients from vet_messages and SOAP notes
 const { data: messagePatients, error: msgError } = await supabase
 .from("vet_messages")
 .select(`
 pet_id,
 user_id,
 pet_profiles:pet_id (id, name, type, breed),
 profiles:user_id (id, full_name, email, phone)
 `)
 .eq("vet_id", vetId)
 .not("pet_id","is", null);

 if (msgError) throw msgError;

 // Get patients from SOAP notes
 const { data: soapPatients, error: soapError } = await supabase
 .from("pet_soap_notes")
 .select(`
 pet_id,
 visit_date,
 pet_profiles:pet_id (id, name, type, breed, user_id)
 `)
 .eq("vet_id", vetId)
 .order("visit_date", { ascending: false });

 if (soapError) throw soapError;

 // Combine and deduplicate patients
 const patientMap = new Map<string, EMRPatient>();

 messagePatients?.forEach((msg: any) => {
 if (msg.pet_profiles && msg.profiles) {
 patientMap.set(msg.pet_id, {
 pet_id: msg.pet_id,
 pet_name: msg.pet_profiles.name,
 pet_type: msg.pet_profiles.type,
 pet_breed: msg.pet_profiles.breed,
 owner_id: msg.user_id,
 owner_name: msg.profiles.full_name ||"Unknown",
 owner_email: msg.profiles.email,
 owner_phone: msg.profiles.phone,
 });
 }
 });

 // Add SOAP note patients and update last visit
 for (const soap of soapPatients || []) {
 if (soap.pet_profiles) {
 const existing = patientMap.get(soap.pet_id);
 if (existing) {
 if (!existing.last_visit || soap.visit_date > existing.last_visit) {
 existing.last_visit = soap.visit_date;
 }
 } else {
 // Need to fetch owner info
 const { data: ownerData } = await supabase
 .from("profiles")
 .select("id, full_name, email, phone")
 .eq("id", (soap.pet_profiles as any).user_id)
 .single();

 if (ownerData) {
 patientMap.set(soap.pet_id, {
 pet_id: soap.pet_id,
 pet_name: (soap.pet_profiles as any).name,
 pet_type: (soap.pet_profiles as any).type,
 pet_breed: (soap.pet_profiles as any).breed,
 owner_id: ownerData.id,
 owner_name: ownerData.full_name ||"Unknown",
 owner_email: ownerData.email,
 owner_phone: ownerData.phone,
 last_visit: soap.visit_date,
 });
 }
 }
 }
 }

 setPatients(Array.from(patientMap.values()));
 } catch (error) {
 console.error("Error loading patients:", error);
 toast.error("Failed to load patients");
 } finally {
 setIsLoading(false);
 }
 };

 const loadRecentActivity = async () => {
 try {
 // Get recent SOAP notes
 const { data: recentSoap } = await supabase
 .from("pet_soap_notes")
 .select(`
 id,
 visit_date,
 subjective_chief_complaint,
 status,
 pet_profiles:pet_id (name)
 `)
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false })
 .limit(5);

 // Get recent lab results
 const { data: recentLabs } = await supabase
 .from("pet_lab_results")
 .select(`
 id,
 test_date,
 test_type,
 status,
 pet_profiles:pet_id (name)
 `)
 .eq("vet_id", vetId)
 .order("created_at", { ascending: false })
 .limit(5);

 const combined = [
 ...(recentSoap?.map((s: any) => ({
 type:"soap",
 id: s.id,
 date: s.visit_date,
 title: `SOAP Note - ${s.subjective_chief_complaint?.substring(0, 30)}...`,
 pet_name: s.pet_profiles?.name,
 status: s.status,
 })) || []),
 ...(recentLabs?.map((l: any) => ({
 type:"lab",
 id: l.id,
 date: l.test_date,
 title: `Lab Results - ${l.test_type}`,
 pet_name: l.pet_profiles?.name,
 status: l.status,
 })) || []),
 ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

 setRecentActivity(combined.slice(0, 10));
 } catch (error) {
 console.error("Error loading recent activity:", error);
 }
 };

 const filteredPatients = patients.filter(
 (p) =>
 p.pet_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 p.owner_name.toLowerCase().includes(searchQuery.toLowerCase())
 );

 if (selectedPatient) {
 return (
 <PatientEMRView
 patient={selectedPatient}
 vetId={vetId}
 onBack={() => setSelectedPatient(null)}
 />
 );
 }

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold">Electronic Medical Records</h2>
 <p className="text-muted-foreground">
 View and manage patient medical records
 </p>
 </div>
 </div>

 <div className="grid gap-6 lg:grid-cols-3">
 {/* Patient List */}
 <div className="lg:col-span-2">
 <Card className="p-4">
 <div className="flex items-center gap-2 mb-4">
 <Search className="w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="Search patients by name or owner..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="flex-1"
 />
 </div>

 <ScrollArea className="h-[500px]">
 {isLoading ? (
 <div className="text-center py-8 text-muted-foreground">
 Loading patients...
 </div>
 ) : filteredPatients.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <PawPrint className="w-12 h-12 mx-auto mb-2 opacity-50" />
 <p>No patients found</p>
 </div>
 ) : (
 <div className="space-y-2">
 {filteredPatients.map((patient) => (
 <Card
 key={patient.pet_id}
 className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
 onClick={() => setSelectedPatient(patient)}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
 <PawPrint className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h3 className="font-semibold">{patient.pet_name}</h3>
 <p className="text-sm text-muted-foreground capitalize">
 {patient.pet_type}
 {patient.pet_breed && ` • ${patient.pet_breed}`}
 </p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-sm font-medium flex items-center gap-1">
 <User className="w-3 h-3" />
 {patient.owner_name}
 </p>
 {patient.last_visit && (
 <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
 <Clock className="w-3 h-3" />
 Last visit: {format(new Date(patient.last_visit),"MMM d, yyyy")}
 </p>
 )}
 </div>
 </div>
 </Card>
 ))}
 </div>
 )}
 </ScrollArea>
 </Card>
 </div>

 {/* Recent Activity */}
 <Card className="p-4">
 <h3 className="font-semibold mb-4 flex items-center gap-2">
 <Clock className="w-4 h-4" />
 Recent Activity
 </h3>
 <ScrollArea className="h-[450px]">
 {recentActivity.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-4">
 No recent activity
 </p>
 ) : (
 <div className="space-y-3">
 {recentActivity.map((activity, idx) => (
 <div
 key={`${activity.type}-${activity.id}`}
 className="p-3 rounded-lg bg-muted/50"
 >
 <div className="flex items-start gap-2">
 {activity.type ==="soap" ? (
 <FileText className="w-4 h-4 mt-0.5 text-info" />
 ) : (
 <FlaskConical className="w-4 h-4 mt-0.5 text-success" />
 )}
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">
 {activity.title}
 </p>
 <p className="text-xs text-muted-foreground">
 {activity.pet_name} •{""}
 {format(new Date(activity.date),"MMM d, yyyy")}
 </p>
 </div>
 <Badge
 variant={
 activity.status ==="finalized" ||
 activity.status ==="reviewed"
 ?"default"
 :"secondary"
 }
 className="text-xs"
 >
 {activity.status}
 </Badge>
 </div>
 </div>
 ))}
 </div>
 )}
 </ScrollArea>
 </Card>
 </div>

 {/* Quick Stats */}
 <div className="grid gap-4 md:grid-cols-4">
 <Card className="p-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-info/10 /30 flex items-center justify-center">
 <FileText className="w-5 h-5 text-info" />
 </div>
 <div>
 <p className="text-2xl font-bold">{patients.length}</p>
 <p className="text-sm text-muted-foreground">Total Patients</p>
 </div>
 </div>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-success/10 /30 flex items-center justify-center">
 <Syringe className="w-5 h-5 text-success" />
 </div>
 <div>
 <p className="text-2xl font-bold">
 {recentActivity.filter((a) => a.type ==="soap").length}
 </p>
 <p className="text-sm text-muted-foreground">Recent SOAP Notes</p>
 </div>
 </div>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 /30 flex items-center justify-center">
 <FlaskConical className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="text-2xl font-bold">
 {recentActivity.filter((a) => a.type ==="lab").length}
 </p>
 <p className="text-sm text-muted-foreground">Pending Labs</p>
 </div>
 </div>
 </Card>
 <Card className="p-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-warning/10 /30 flex items-center justify-center">
 <AlertTriangle className="w-5 h-5 text-warning" />
 </div>
 <div>
 <p className="text-2xl font-bold">0</p>
 <p className="text-sm text-muted-foreground">Critical Alerts</p>
 </div>
 </div>
 </Card>
 </div>
 </div>
 );
};
