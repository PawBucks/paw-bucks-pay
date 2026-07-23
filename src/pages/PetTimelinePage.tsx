import { useEffect, useState } from"react";
import { useNavigate } from"react-router-dom";
import { motion } from"framer-motion";
import { useAuth } from"@/hooks/useAuth";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { BottomNav } from"@/components/BottomNav";
import { PetTimeline } from"@/components/timeline";
import { Button } from"@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { DashboardSkeleton } from"@/components/LoadingSkeleton";

type PetProfile = {
 id: string;
 name: string;
 type:"dog" |"cat" |"other";
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

 const filteredPets = selectedPetId ==="all" 
 ? pets 
 : pets.filter(p => p.id === selectedPetId);

 return (
 <>
 <SEO 
 title="Pet Timeline - PawBucks"
 description="See your pet's story unfold. Every purchase becomes a memory in their timeline."
 keywords={["pet timeline","pet memories","PawBucks history"]}
 noIndex={true}
 />
 <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-background">
 <Header isAuthenticated={true} onLogout={handleSignOut} userId={user?.id} />
 
  <main className="mx-auto w-full max-w-4xl min-w-0 flex-1 overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 md:pb-10">
 {/* Header */}
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
   className="mb-5 min-w-0 overflow-hidden sm:mb-6"
 >
 <Button 
 variant="ghost" 
 size="sm" 
 onClick={() => navigate("/home")}
 className="mb-4 -ml-2"
 >
 <ArrowLeft className="w-4 h-4 mr-2" />
 Back to Dashboard
 </Button>
 
   <div className="mb-2 flex min-w-0 items-center gap-3 sm:gap-4">
  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 sm:h-12 sm:w-12">
  <Sparkles className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
 </div>
  <div className="min-w-0">
   <h1 className="break-words text-2xl font-semibold leading-tight tracking-normal sm:text-3xl">
 Your Pet's Story
 </h1>
   <p className="break-words text-sm leading-relaxed text-muted-foreground sm:text-base">
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
   className="mb-5 min-w-0 overflow-hidden sm:mb-6"
 >
  <Tabs value={selectedPetId} onValueChange={setSelectedPetId} className="min-w-0 overflow-hidden">
  <TabsList className="flex h-auto w-full min-w-0 justify-start gap-2 overflow-x-auto bg-transparent p-0 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
 <TabsTrigger 
 value="all" 
  className="flex-shrink-0 rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
 >
 All Pets
 </TabsTrigger>
 {pets.map((pet) => (
 <TabsTrigger
 key={pet.id}
 value={pet.id}
   className="max-w-[11rem] flex-shrink-0 gap-2 rounded-full px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:max-w-full sm:px-4"
 >
 {pet.photo_url ? (
 <img 
 src={pet.photo_url} 
 alt={pet.name}
 className="w-5 h-5 rounded-full object-cover"
 />
 ) : (
 <span>{pet.type ==="cat" ?"🐱" :"🐕"}</span>
 )}
  <span className="truncate">{pet.name}</span>
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
   className="w-full max-w-full min-w-0 overflow-visible"
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
