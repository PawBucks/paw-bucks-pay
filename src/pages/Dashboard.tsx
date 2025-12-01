import { useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { DataLoader } from "@/lib/dataLoader";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { ReferralCard } from "@/components/ReferralCard";
import { AdPlacement } from "@/components/AdPlacement";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { WalletStats } from "@/components/dashboard/WalletStats";
import { PetProfilesSection } from "@/components/dashboard/PetProfilesSection";
import { DiscoverServicesCard } from "@/components/dashboard/DiscoverServicesCard";
import { Store, Users, TrendingUp } from "lucide-react";

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
  const { data, isLoading: dataLoading, refetch } = useOptimizedQuery(
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
            <WalletStats 
              balance={wallet?.balance || 0} 
              rewardsPoints={wallet?.rewards_points || 0}
            />
            
            <PetProfilesSection pets={pets} onUpdate={() => refetch()} />
            
            <ReferralCard />
            
            <DiscoverServicesCard />
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