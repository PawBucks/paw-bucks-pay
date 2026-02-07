import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { BottomNav } from "@/components/BottomNav";
import { PetTimeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";

type PetProfile = {
  id: string;
  name: string;
  type: "dog" | "cat" | "other";
  photo_url?: string;
};

const PetTimelinePage = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const sharedAccount = useSharedAccount(user?.id);
  const effectiveWalletUserId = getEffectiveWalletUserId(user?.id, sharedAccount);
  
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPetId, setSelectedPetId] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!effectiveWalletUserId || sharedAccount.isLoading) return;

    const fetchPets = async () => {
      try {
        const { data, error } = await supabase
          .from("pet_profiles")
          .select("id, name, type, photo_url")
          .eq("user_id", effectiveWalletUserId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setPets(data || []);
      } catch (error) {
        console.error("[PetTimelinePage] Error fetching pets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPets();
  }, [effectiveWalletUserId, sharedAccount.isLoading]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated={true} onLogout={handleSignOut} userId={user?.id} />
        <main className="container mx-auto px-4 py-8">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  const filteredPets = selectedPetId === "all" 
    ? pets 
    : pets.filter(p => p.id === selectedPetId);

  return (
    <>
      <SEO 
        title="Pet Timeline - PawBucks"
        description="See your pet's story unfold. Every purchase becomes a memory in their timeline."
        keywords={["pet timeline", "pet memories", "PawBucks history"]}
        noIndex={true}
      />
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated={true} onLogout={handleSignOut} userId={user?.id} />
        
        <main className="flex-1 container mx-auto px-4 pt-4 pb-24 md:pb-8 max-w-3xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="mb-4 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  ✨ Your Pet's Story, Unlocked
                </h1>
                <p className="text-muted-foreground">
                  Every paw print, vet visit, and snack run adds to their timeline
                </p>
              </div>
            </div>
          </motion.div>

          {/* Pet Filter Tabs */}
          {pets.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6"
            >
              <Tabs value={selectedPetId} onValueChange={setSelectedPetId}>
                <TabsList className="w-full flex-wrap h-auto gap-2 bg-transparent p-0">
                  <TabsTrigger 
                    value="all" 
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4"
                  >
                    All Pets
                  </TabsTrigger>
                  {pets.map((pet) => (
                    <TabsTrigger
                      key={pet.id}
                      value={pet.id}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 gap-2"
                    >
                      {pet.photo_url ? (
                        <img 
                          src={pet.photo_url} 
                          alt={pet.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <span>{pet.type === "cat" ? "🐱" : "🐕"}</span>
                      )}
                      {pet.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </motion.div>
          )}

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {effectiveWalletUserId && (
              <PetTimeline 
                userId={effectiveWalletUserId}
                pets={filteredPets}
                limit={50}
                showHeader={false}
              />
            )}
          </motion.div>
        </main>
        
        <BottomNav />
      </div>
    </>
  );
};

export default PetTimelinePage;
