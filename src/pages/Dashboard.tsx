import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { DataLoader } from "@/lib/dataLoader";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { PetProfileCard } from "@/components/PetProfileCard";
import { ReferralCard } from "@/components/ReferralCard";
import { AdPlacement } from "@/components/AdPlacement";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { Wallet, Gift, TrendingUp, LogOut, Store, Users, Plus } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  user_type: "pet_owner" | "merchant";
  full_name: string;
};

type WalletData = {
  balance: number;
  rewards_points: number;
};

type PetProfile = {
  id: string;
  name: string;
  type: "dog" | "cat" | "other";
  breed?: string;
  birthday?: string;
  photo_url?: string;
};

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  
  // Batch load all dashboard data in parallel
  const { data, isLoading: dataLoading } = useOptimizedQuery(
    ['dashboard', user?.id || ''],
    async () => {
      if (!user) return null;
      
      return await DataLoader.batchLoad({
        profile: () => DataLoader.loadUserProfile(user.id),
        wallet: () => DataLoader.loadWalletData(user.id),
        pets: () => DataLoader.loadPetProfiles(user.id),
      });
    },
    { staleTime: 1000 * 60 * 5 }
  );

  const profile = data?.profile;
  const wallet = data?.wallet;
  const pets = data?.pets || [];

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (!loading && !user) {
        navigate("/auth");
      } else if (!loading && user && profile) {
        // Check if user is admin
        const { data: isAdmin } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (isAdmin) {
          navigate("/admin");
        } else if (profile.user_type === "merchant") {
          navigate("/merchant-dashboard");
        }
      }
    };

    checkUserAndRedirect();
  }, [user, loading, profile, navigate]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/auth");
  }, [signOut, navigate]);

  if (loading || dataLoading || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated={true} onLogout={handleSignOut} />
        <main className="container mx-auto px-4 py-8">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated={true} onLogout={handleSignOut} />

      <main className="container mx-auto px-4 pt-6 pb-24 md:pb-12 max-w-7xl">
        {/* Ad Placement for Free Users */}
        <div className="mb-6">
          <AdPlacement />
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {profile.full_name}!</h2>
          <p className="text-muted-foreground">
            {profile.user_type === "pet_owner" ? "Manage your pet expenses and rewards" : "Manage your business transactions"}
          </p>
        </div>

        {profile.user_type === "pet_owner" ? (
          <div className="grid gap-6 md:grid-cols-3">
            <GradientCard gradient>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Wallet Balance</p>
                  <p className="text-2xl font-bold">${wallet?.balance?.toFixed(2) || "0.00"}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <Gift className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rewards Points</p>
                  <p className="text-2xl font-bold">{wallet?.rewards_points || 0}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Saved</p>
                  <p className="text-2xl font-bold">$0.00</p>
                </div>
              </div>
            </GradientCard>

            {/* Pet Profiles Section */}
            <GradientCard className="md:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">My Pets</h3>
                <Button onClick={() => navigate("/create-pet-profile")} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pet
                </Button>
              </div>
              {pets.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {pets.map((pet) => (
                    <PetProfileCard key={pet.id} pet={pet} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    You haven't added any pets yet
                  </p>
                  <Button onClick={() => navigate("/create-pet-profile")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Pet
                  </Button>
                </div>
              )}
            </GradientCard>

            <ReferralCard />

            <GradientCard className="md:col-span-3">
              <h3 className="text-xl font-semibold mb-4">Discover Pet Services</h3>
              <p className="text-muted-foreground">Find nearby pet stores, groomers, and trainers to earn cashback on your purchases.</p>
              <div className="mt-4 flex gap-4">
                <Button onClick={() => navigate("/discover")}>Discover Services</Button>
                <Button variant="outline" onClick={() => navigate("/wallet")}>View Wallet</Button>
              </div>
            </GradientCard>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <GradientCard gradient>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold">$0.00</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Store className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard className="md:col-span-3">
              <h3 className="text-xl font-semibold mb-4">Business Management</h3>
              <p className="text-muted-foreground">View transactions, manage your business profile, and track analytics.</p>
              <div className="mt-4 flex gap-4">
                <Button>View Transactions</Button>
                <Button variant="outline">Edit Profile</Button>
              </div>
            </GradientCard>
          </div>
        )}

        {/* Bottom Ad Placement */}
        {profile.user_type === "pet_owner" && (
          <div className="mt-8 mb-6 pb-24">
            <AdPlacement position="bottom" />
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;