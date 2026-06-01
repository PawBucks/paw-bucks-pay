import { useState, useEffect } from"react";
import { useNavigate, useParams, useSearchParams } from"react-router-dom";
import { supabase } from"@/integrations/supabase/client";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { Header } from"@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { MedicalRecordUpload } from"@/components/MedicalRecordUpload";
import { MedicalRecordsList } from"@/components/MedicalRecordsList";
import { ScanVetPaperwork } from"@/components/ScanVetPaperwork";
import { VetCommunication } from"@/components/VetCommunication";
import { PetProfileCard } from"@/components/PetProfileCard";
import { ShareHealthRecordsDialog } from"@/components/ShareHealthRecordsDialog";
import { PetEmailInbox } from"@/components/pet-health/PetEmailInbox";
import { ArrowLeft, FileHeart, Mail, MessageSquare, Users } from "lucide-react";
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
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">Loading...</div>
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
      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
 <Button
 variant="ghost"
 onClick={() => navigate("/home")}
          className="-ml-2 text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4 mr-2" />
 Back to Dashboard
 </Button>

 {/* Shared Account Banner */}
 {sharedAccount.isSharedMember && sharedAccount.ownerName && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
 <span className="text-sm">
 Viewing shared account with <strong>{sharedAccount.ownerName}</strong>
 </span>
 </div>
 )}

        {/* Hero header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <FileHeart className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pet Health Records</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage medical records and communicate with vets for {pet.name}
            </p>
          </div>
        </div>

        {/* Pet profile card */}
        <PetProfileCard pet={pet} onUpdate={loadPet} />

        {/* Quick actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <ShareHealthRecordsDialog petId={pet.id} petName={pet.name} />
          </div>
          <div className="flex-1">
            <ScanVetPaperwork
              petId={pet.id}
              petName={pet.name}
              petType={pet.type}
              petBreed={pet.breed}
              onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="w-full h-auto bg-transparent border-b border-border rounded-none p-0 justify-start gap-0">
            <TabsTrigger
              value="records"
              className="flex-1 sm:flex-none flex items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <FileHeart className="w-4 h-4" />
              Medical Records
            </TabsTrigger>
            <TabsTrigger
              value="inbox"
              className="flex-1 sm:flex-none flex items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <Mail className="w-4 h-4" />
              Email Inbox
            </TabsTrigger>
            <TabsTrigger
              value="vets"
              className="flex-1 sm:flex-none flex items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <MessageSquare className="w-4 h-4" />
              Vet Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <MedicalRecordUpload
                petId={pet.id}
                onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
              />
            </div>
            <MedicalRecordsList petId={pet.id} refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="inbox" className="space-y-4 mt-4">
            <PetEmailInbox petId={pet.id} petName={pet.name} />
          </TabsContent>

          <TabsContent value="vets" className="mt-4">
            <VetCommunication petId={pet.id} />
          </TabsContent>
        </Tabs>
 </div>
 </div>
 );
}
