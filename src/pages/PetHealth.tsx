import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MedicalRecordUpload } from "@/components/MedicalRecordUpload";
import { MedicalRecordsList } from "@/components/MedicalRecordsList";
import { VetCommunication } from "@/components/VetCommunication";
import { PetProfileCard } from "@/components/PetProfileCard";
import { ArrowLeft, FileHeart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type PetProfile = {
  id: string;
  name: string;
  type: "dog" | "cat" | "other";
  breed?: string;
  birthday?: string;
  photo_url?: string;
};

export default function PetHealth() {
  const navigate = useNavigate();
  const { petId } = useParams<{ petId: string }>();
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      if (!petId) {
        navigate("/dashboard");
        return;
      }

      loadPet();
    };

    checkAuth();
  }, [navigate, petId]);

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
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-4xl mx-auto px-4 py-8">
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
      <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <FileHeart className="w-8 h-8 text-primary" />
            Pet Health Records
          </h1>
          <p className="text-muted-foreground">
            Manage medical records and communicate with vets for {pet.name}
          </p>
        </div>

        <PetProfileCard pet={pet} onUpdate={loadPet} />

        <Tabs defaultValue="records" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="records" className="flex items-center gap-2">
              <FileHeart className="w-4 h-4" />
              Medical Records
            </TabsTrigger>
            <TabsTrigger value="vets" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Vet Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4">
            <div className="flex justify-end">
              <MedicalRecordUpload
                petId={pet.id}
                onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
              />
            </div>
            <MedicalRecordsList petId={pet.id} refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="vets">
            <VetCommunication petId={pet.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
