import { useState, useEffect } from"react";
import { useNavigate, useParams, useSearchParams } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { Card } from"@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { MedicalRecordUpload } from"@/components/MedicalRecordUpload";
import { MedicalRecordsList } from"@/components/MedicalRecordsList";
import { ScanVetPaperwork } from"@/components/ScanVetPaperwork";
import { VetCommunication } from"@/components/VetCommunication";
import { PetProfileCard } from"@/components/PetProfileCard";
import { ShareHealthRecordsDialog } from"@/components/ShareHealthRecordsDialog";
import { PetEmailInbox } from"@/components/pet-health/PetEmailInbox";
import { ArrowLeft, FileHeart } from "lucide-react";
import { Button } from"@/components/ui/button";
import { toast } from"sonner";

type PetProfile = {
 id: string;
 name: string;
 type:"dog" |"cat" |"other";
 breed?: string;
 birthday?: string;
 photo_url?: string;
};

export default function PetHealth() {
 const navigate = useNavigate();
 const { petId } = useParams<{ petId: string }>();
 const [searchParams] = useSearchParams();
 const defaultTab = searchParams.get("tab") ||"records";
 const [pet, setPet] = useState<PetProfile | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [refreshTrigger, setRefreshTrigger] = useState(0);
 const [userId, setUserId] = useState<string | undefined>();

 // Get shared account info
 const sharedAccount = useSharedAccount(userId);
 const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);

 useEffect(() => {
 const checkAuth = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 navigate("/auth");
 return;
 }
 
 setUserId(user.id);

 if (!petId) {
 navigate("/home");
 return;
 }
 };

 checkAuth();
 }, [navigate, petId]);

 // Load pet data once we have the effective user ID
 useEffect(() => {
 if (!petId || sharedAccount.isLoading) return;
 
 const loadPet = async () => {
 try {
 // The RLS policy now allows access if user is shared member
 const { data, error } = await supabase
 .from("pet_profiles")
 .select("*")
 .eq("id", petId)
 .single();

 if (error) throw error;
 setPet(data);
 } catch (error) {
 console.error("Error loading pet:", error);
 toast.error("Failed to load pet information");
 navigate("/home");
 } finally {
 setIsLoading(false);
 }
 };

 loadPet();
 }, [petId, sharedAccount.isLoading, navigate]);

 const loadPet = async () => {
 try {
 const { data, error } = await supabase
 .from("pet_profiles")
 .select("*")
 .eq("id", petId)
 .single();

 if (error) throw error;
 setPet(data);
 } catch (error) {
 console.error("Error loading pet:", error);
 toast.error("Failed to load pet information");
 }
 };

 if (isLoading || sharedAccount.isLoading) {
 return (
 <div className="min-h-screen bg-background">
 <Header />
 <div className="container max-w-4xl lg:max-w-6xl mx-auto px-4 py-8">
 <div className="text-center">Loading...</div>
 </div>
 </div>
 );
 }

 if (!pet) {
 return null;
 }

 return (
 <div className="min-h-screen bg-background">
 <Header />
 <div className="container max-w-4xl lg:max-w-6xl mx-auto px-4 py-8 space-y-6">
 <Button
 variant="ghost"
 onClick={() => navigate("/home")}
 className="mb-4"
 >
 <ArrowLeft className="w-4 h-4 mr-2" />
 Back to Dashboard
 </Button>

 {/* Shared Account Banner */}
 {sharedAccount.isSharedMember && sharedAccount.ownerName && (
 <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2">
 <span className="w-4 h-4 text-primary" aria-hidden="true">👥</span>
 <span className="text-sm">
 Viewing shared account with <strong>{sharedAccount.ownerName}</strong>
 </span>
 </div>
 )}

 <div>
 <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
 <FileHeart className="w-8 h-8 text-primary" />
 Pet Health Records
 </h1>
 <p className="text-muted-foreground">
 Manage medical records and communicate with vets for {pet.name}
 </p>
 </div>

 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div className="flex-1 w-full">
 <PetProfileCard pet={pet} onUpdate={loadPet} />
 </div>
 <ShareHealthRecordsDialog petId={pet.id} petName={pet.name} />
 </div>

 <Tabs defaultValue={defaultTab} className="space-y-4">
 <TabsList className="grid w-full grid-cols-3">
 <TabsTrigger value="records" className="flex items-center gap-2">
 <FileHeart className="w-4 h-4" />
 Medical Records
 </TabsTrigger>
 <TabsTrigger value="inbox" className="flex items-center gap-2">
 <span className="w-4 h-4" aria-hidden="true">📧</span>
 Email Inbox
 </TabsTrigger>
 <TabsTrigger value="vets" className="flex items-center gap-2">
 <span className="w-4 h-4" aria-hidden="true">💬</span>
 Vet Messages
 </TabsTrigger>
 </TabsList>

 <TabsContent value="records" className="space-y-4">
 <div className="flex justify-end gap-2 flex-wrap">
 <ScanVetPaperwork
 petId={pet.id}
 petName={pet.name}
 petType={pet.type}
 petBreed={pet.breed}
 onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
 />
 <MedicalRecordUpload
 petId={pet.id}
 onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
 />
 </div>
 <MedicalRecordsList petId={pet.id} refreshTrigger={refreshTrigger} />
 </TabsContent>

 <TabsContent value="inbox" className="space-y-4">
 <PetEmailInbox petId={pet.id} petName={pet.name} />
 </TabsContent>

 <TabsContent value="vets">
 <VetCommunication petId={pet.id} />
 </TabsContent>
 </Tabs>
 </div>
 </div>
 );
}
