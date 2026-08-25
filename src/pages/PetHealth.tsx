import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MedicalRecordUpload } from "@/components/MedicalRecordUpload";
import { MedicalRecordsList } from "@/components/MedicalRecordsList";
import { ScanVetPaperwork } from "@/components/ScanVetPaperwork";
import { VetCommunication } from "@/components/VetCommunication";
import { ShareHealthRecordsDialog } from "@/components/ShareHealthRecordsDialog";
import { PetEmailInbox } from "@/components/pet-health/PetEmailInbox";
import { PetHealthSpendingSummary } from "@/components/pet-health/PetHealthSpendingSummary";
import { EditPetProfileDialog } from "@/components/EditPetProfileDialog";
import { ArrowLeft, FileHeart, Mail, MessageSquare, Users, Pencil, IdCard, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseDateOnly } from "@/lib/timezone";
import { usePetPersonality } from "@/hooks/usePersonalityBadges";
import { transformPersonalityName } from "@/components/personality-quiz/personalityNameUtils";

type PetProfile = {
  id: string;
  name: string;
  type: "dog" | "cat" | "other";
  breed?: string;
  birthday?: string;
  photo_url?: string;
};

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐶",
  cat: "🐱",
  other: "🐾",
};

export default function PetHealth() {
  const navigate = useNavigate();
  const { petId } = useParams<{ petId: string }>();
  const { signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "records";
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [userId, setUserId] = useState<string | undefined>();
  const [editOpen, setEditOpen] = useState(false);

  // Get shared account info
  const sharedAccount = useSharedAccount(userId);
  const effectiveUserId = getEffectiveWalletUserId(userId, sharedAccount);
  const { data: personalityData } = usePetPersonality(petId || "");

  const personalityLabel = useMemo(
    () => (personalityData?.name && pet ? transformPersonalityName(personalityData.name, pet.type) : null),
    [personalityData?.name, pet]
  );

  const age = useMemo(() => {
    if (!pet?.birthday) return null;
    const dob = parseDateOnly(pet.birthday);
    if (!dob) return null;
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--;
    return years;
  }, [pet?.birthday]);

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

    const load = async () => {
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
        navigate("/home");
      } finally {
        setIsLoading(false);
      }
    };

    load();
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
        <Header isAuthenticated onLogout={signOut} userId={userId} />
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">Loading health records…</div>
        </div>
      </div>
    );
  }

  if (!pet) {
    return null;
  }

  const tabTriggerClass =
    "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs sm:text-sm font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={signOut} userId={userId} />
      <div className="container max-w-4xl mx-auto px-4 py-5 space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/home")}
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Dashboard
        </Button>

        {/* Shared Account Banner */}
        {sharedAccount.isSharedMember && sharedAccount.ownerName && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2">
            <Users className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm min-w-0">
              Viewing shared account with <strong>{sharedAccount.ownerName}</strong>
            </span>
          </div>
        )}

        {/* Hero */}
        <Card className="p-5 bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <div className="flex items-start gap-4">
            {pet.photo_url ? (
              <img
                src={pet.photo_url}
                alt={`${pet.name}, ${pet.breed || pet.type}`}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/20 flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-3xl flex-shrink-0">
                <span aria-hidden="true">{SPECIES_EMOJI[pet.type] || SPECIES_EMOJI.other}</span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              {personalityLabel && (
                <Badge variant="secondary" className="mb-1.5 bg-accent/10 text-accent border-accent/20">
                  ✨ {personalityLabel}
                </Badge>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{pet.name}</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <Badge variant="outline" className="capitalize text-xs">{pet.type}</Badge>
                {pet.breed && <Badge variant="outline" className="text-xs">{pet.breed}</Badge>}
                {age !== null && <Badge variant="outline" className="text-xs">{age} yr</Badge>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <Button variant="ghost" size="icon" title="Edit profile" onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Digital ID card"
                onClick={() => navigate(`/pet-id/${pet.id}`)}
              >
                <IdCard className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Pet timeline"
                onClick={() => navigate("/pet-timeline")}
              >
                <PawPrint className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-4">
            Medical records, inbound vet documents and messages for {pet.name}.
          </p>
        </Card>

        {/* Quick actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 [&_button]:w-full">
            <ShareHealthRecordsDialog petId={pet.id} petName={pet.name} />
          </div>
          <div className="flex-1 [&_button]:w-full">
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
          <TabsList className="w-full h-auto bg-muted/60 rounded-xl p-1 gap-1">
            <TabsTrigger value="records" className={tabTriggerClass}>
              <FileHeart className="w-4 h-4" />
              <span className="truncate">Medical</span>
            </TabsTrigger>
            <TabsTrigger value="inbox" className={tabTriggerClass}>
              <Mail className="w-4 h-4" />
              <span className="truncate">Email Inbox</span>
            </TabsTrigger>
            <TabsTrigger value="vets" className={tabTriggerClass}>
              <MessageSquare className="w-4 h-4" />
              <span className="truncate">Vet Messages</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4 mt-4">
            <PetHealthSpendingSummary petId={pet.id} refreshTrigger={refreshTrigger} />
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

      <EditPetProfileDialog
        pet={pet as any}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={loadPet}
      />
    </div>
  );
}
