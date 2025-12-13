import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
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
import { BottomNav } from "@/components/BottomNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Store, Users, TrendingUp } from "lucide-react";

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: "easeOut" as const,
    },
  }),
};
type Profile = {
  user_type: "pet_owner" | "merchant";
  full_name: string;
};

type WalletData = {
  balance: number;
  rewards_points: number;
  total_spent: number;
};

type PawBucksWallet = {
  balance: number;
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
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [pawbucksWallet, setPawbucksWallet] = useState<PawBucksWallet | null>(null);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Direct fetch function - no caching that could cause stale data
  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    
    try {
      // Fetch all data in parallel directly from Supabase
      const [profileResult, walletResult, pawbucksResult, petsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_type, full_name')
          .eq('id', user.id)
          .single(),
        supabase
          .from('wallets')
          .select('balance, rewards_points, total_spent')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('pawbucks_wallet')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('pet_profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
      }
      
      if (walletResult.data) {
        setWallet(walletResult.data);
      }

      if (pawbucksResult.data) {
        setPawbucksWallet(pawbucksResult.data);
      }
      
      if (petsResult.data) {
        setPets(petsResult.data as PetProfile[]);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching data:', error);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  // Fetch data when user changes
  useEffect(() => {
    if (user && !authLoading) {
      fetchDashboardData();
    }
  }, [user, authLoading, fetchDashboardData]);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (!authLoading && !user) {
        navigate("/auth");
      } else if (!authLoading && user && profile) {
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
  }, [user, authLoading, profile, navigate]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/auth");
  }, [signOut, navigate]);

  // Handle refetch when pets are updated
  const handlePetsUpdate = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Pull to refresh
  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: fetchDashboardData,
  });

  if (authLoading || dataLoading || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated={true} onLogout={handleSignOut} userId={user?.id} />
        <main className="container mx-auto px-4 py-8">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <Header isAuthenticated={true} onLogout={handleSignOut} userId={user?.id} />

      <PullToRefresh
        ref={containerRef}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        progress={progress}
        className="flex-1 overflow-auto"
      >
        <main className="container mx-auto px-4 pt-4 pb-24 md:pb-8 max-w-7xl">
          {/* Ad Placement for Free Users */}
          <div className="mb-4 sm:mb-6">
          <AdPlacement />
        </div>

        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold mb-1">Welcome back, {profile.full_name}!</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {profile.user_type === "pet_owner" ? "Manage your pet expenses and rewards" : "Manage your business transactions"}
          </p>
        </div>

        {profile.user_type === "pet_owner" ? (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible" className="md:col-span-2 lg:col-span-2">
              <WalletStats 
                balance={(pawbucksWallet?.balance || 0) * 0.001} 
                rewardsPoints={pawbucksWallet?.balance || 0}
                totalSaved={(pawbucksWallet?.balance || 0) * 0.001}
                totalSpent={wallet?.total_spent || 0}
              />
            </motion.div>
            
            <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
              <PetProfilesSection pets={pets} onUpdate={handlePetsUpdate} />
            </motion.div>
            
            <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
              <ReferralCard />
            </motion.div>
            
            <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible">
              <DiscoverServicesCard />
            </motion.div>
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
            <div className="mt-6 sm:mt-8">
              <AdPlacement position="bottom" />
            </div>
          )}
        </main>
      </PullToRefresh>
      
      <BottomNav />
    </div>
  );
};

export default Dashboard;