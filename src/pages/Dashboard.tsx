import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePawBucksRealtime } from "@/hooks/usePawBucksRealtime";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { ReferralCard } from "@/components/ReferralCard";
import { SharePawBucksCard } from "@/components/SharePawBucksCard";
import { AdPlacement } from "@/components/AdPlacement";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { WalletStats } from "@/components/dashboard/WalletStats";
import { PetProfilesSection } from "@/components/dashboard/PetProfilesSection";
import { DiscoverServicesCard } from "@/components/dashboard/DiscoverServicesCard";
import { AutoRedeemEducationCard } from "@/components/dashboard/AutoRedeemEducationCard";
import { PetOwnerInvoices } from "@/components/dashboard/PetOwnerInvoices";
import { BottomNav } from "@/components/BottomNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { ReceiptUploadDialog } from "@/components/ReceiptUploadDialog";
import { Store, Users, TrendingUp, Receipt } from "lucide-react";

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

type MedicalRecordSpending = {
  total: number;
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
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  
  // Check if user is part of a shared account
  const sharedAccount = useSharedAccount(user?.id);
  const effectiveWalletUserId = getEffectiveWalletUserId(user?.id, sharedAccount);
  
  // Enable realtime updates for PawBucks on pet owner dashboard (use effective user ID)
  usePawBucksRealtime(effectiveWalletUserId);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [pawbucksWallet, setPawbucksWallet] = useState<PawBucksWallet | null>(null);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [medicalSpending, setMedicalSpending] = useState<number>(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  
  const isPawPassSubscriber = subscription.subscribed;

  // Direct fetch function - optimized with parallel loading
  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setDataLoading(false);
      return;
    }
    
    if (sharedAccount.isLoading) {
      return;
    }

    setDataLoading(true);
    
    // Calculate wallet user ID inside the callback to avoid stale closure
    const walletUserId = sharedAccount.isSharedMember && sharedAccount.ownerId 
      ? sharedAccount.ownerId 
      : user.id;
    
    try {
      // Fetch all data in parallel directly from Supabase - optimized queries
      const [profileResult, walletResult, pawbucksResult, petsResult, medicalResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_type, full_name')
          .eq('id', user.id)
          .single()
          .throwOnError(),
        supabase
          .from('wallets')
          .select('balance, rewards_points, total_spent')
          .eq('user_id', walletUserId)
          .maybeSingle(),
        supabase
          .from('pawbucks_wallet')
          .select('balance')
          .eq('user_id', walletUserId)
          .maybeSingle(),
        supabase
          .from('pet_profiles')
          .select('id, name, type, breed, birthday, photo_url')
          .eq('user_id', walletUserId)
          .order('created_at', { ascending: false })
          .limit(10), // Limit to 10 pets for faster loading
        supabase
          .from('pet_medical_records')
          .select('price')
          .eq('user_id', walletUserId)
          .not('price', 'is', null)
          .limit(100) // Limit medical records for faster aggregation
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

      // Calculate total medical spending from records with prices
      if (medicalResult.data) {
        const totalMedical = medicalResult.data.reduce((sum, record) => {
          return sum + (record.price || 0);
        }, 0);
        setMedicalSpending(totalMedical);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching data:', error);
    } finally {
      setDataLoading(false);
    }
  }, [user, sharedAccount.isLoading, sharedAccount.isSharedMember, sharedAccount.ownerId]);

  // Fetch data when user changes or shared account status is determined
  useEffect(() => {
    if (user && !authLoading && !sharedAccount.isLoading) {
      fetchDashboardData();
    }
  }, [user, authLoading, sharedAccount.isLoading, fetchDashboardData]);

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
    <>
      <SEO 
        title="Dashboard - PawBucks"
        description="Manage your pet expenses, track PawBucks rewards, and discover pet services. View your wallet balance and pet profiles."
        keywords={["pet dashboard", "PawBucks wallet", "pet rewards", "pet expenses tracker"]}
        noIndex={true}
      />
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
          {/* Shared Account Indicator */}
          {sharedAccount.isSharedMember && sharedAccount.ownerName && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
              <Users className="w-4 h-4" />
              Viewing shared account with {sharedAccount.ownerName}
            </div>
          )}
        </div>

        {profile.user_type === "pet_owner" ? (
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Auto-Redeem Education Card - Prominent placement for users with PawBucks */}
            {user && (pawbucksWallet?.balance || 0) > 0 && (
              <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
                <AutoRedeemEducationCard 
                  userId={user.id} 
                  pawbucksBalance={pawbucksWallet?.balance || 0} 
                />
              </motion.div>
            )}
            
            {/* Row 1: Wallet Stats (Total Saved & Total Spending) */}
            <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
              <WalletStats 
                balance={(pawbucksWallet?.balance || 0) * 0.001} 
                rewardsPoints={pawbucksWallet?.balance || 0}
                totalSaved={(pawbucksWallet?.balance || 0) * 0.001}
                totalSpent={(wallet?.total_spent || 0) + medicalSpending}
              />
            </motion.div>
            
            {/* PawPass+ Receipt Upload Card */}
            {isPawPassSubscriber && (
              <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
                <GradientCard className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Earn PawBucks on Any Purchase</h3>
                        <p className="text-sm text-muted-foreground">
                          Upload receipts from pet merchants not on our platform
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => setReceiptDialogOpen(true)}>
                      Upload Receipt
                    </Button>
                  </div>
                </GradientCard>
              </motion.div>
            )}
            
            {/* Row 2: My Pets - Full Width */}
            <motion.div custom={isPawPassSubscriber ? 3 : 2} variants={cardVariants} initial="hidden" animate="visible">
              <PetProfilesSection pets={pets} onUpdate={handlePetsUpdate} />
            </motion.div>
            
            {/* Row 3: My Invoices - Shows invoices sent to this pet owner */}
            {user?.email && (
              <motion.div custom={isPawPassSubscriber ? 4 : 3} variants={cardVariants} initial="hidden" animate="visible">
                <PetOwnerInvoices userEmail={user.email} />
              </motion.div>
            )}
            
            {/* Row 4: Share PawBucks - Full Width */}
            <motion.div custom={isPawPassSubscriber ? 5 : 4} variants={cardVariants} initial="hidden" animate="visible">
              <SharePawBucksCard />
            </motion.div>
            
            {/* Row 5: Referral Program & Discover Pet Services - Side by Side on larger screens */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              <motion.div custom={isPawPassSubscriber ? 6 : 5} variants={cardVariants} initial="hidden" animate="visible">
                <ReferralCard />
              </motion.div>
              
              <motion.div custom={isPawPassSubscriber ? 7 : 6} variants={cardVariants} initial="hidden" animate="visible">
                <DiscoverServicesCard />
              </motion.div>
            </div>
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
      
      {/* Receipt Upload Dialog for PawPass+ subscribers */}
      {user && (
        <ReceiptUploadDialog
          open={receiptDialogOpen}
          onOpenChange={setReceiptDialogOpen}
          userId={user.id}
        />
      )}
    </div>
    </>
  );
};

export default Dashboard;
