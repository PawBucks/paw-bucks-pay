import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePawBucksRealtime } from "@/hooks/usePawBucksRealtime";
import { useDashboardData } from "@/hooks/useDashboardData";
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
import { ActionRequiredSlices } from "@/components/dashboard/ActionRequiredSlices";
import { BottomNav } from "@/components/BottomNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { ReceiptUploadDialog } from "@/components/ReceiptUploadDialog";
import { TimelineTeaser } from "@/components/timeline";
import { BadgeTeaser } from "@/components/badges";
import { PersonalityQuizCTA } from "@/components/dashboard/PersonalityQuizCTA";
import { LoyaltyDashboardWidget } from "@/components/loyalty";
import { CustomerLoyaltyCards } from "@/components/dashboard/CustomerLoyaltyCards";
import { LoyaltyProgramDiscovery } from "@/components/dashboard/LoyaltyProgramDiscovery";
import { WelcomeCreditCard } from "@/components/dashboard/WelcomeCreditCard";
import { MaximusChat } from "@/components/maximus/MaximusChat";
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

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  // TanStack Query-powered data fetching (leverages prefetch cache)
  const {
    profile,
    pawbucksWallet,
    pets,
    totalSpent,
    medicalSpending,
    dataLoading,
    sharedAccount,
    effectiveWalletUserId,
    refetchAll,
  } = useDashboardData();

  // Enable realtime updates for PawBucks
  usePawBucksRealtime(effectiveWalletUserId);

  const isPawPassSubscriber = subscription.subscribed;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!authLoading && user && profile) {
      if (profile.user_type === "merchant") {
        navigate("/merchant-dashboard");
      }
    }
  }, [user, authLoading, profile, navigate]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/auth");
  }, [signOut, navigate]);

  const handlePetsUpdate = useCallback(() => {
    refetchAll();
  }, [refetchAll]);

  // Pull to refresh
  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: refetchAll,
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
            {/* Welcome Credit Card - First-time user conversion */}
            {user && (
              <WelcomeCreditCard userId={user.id} />
            )}
            
            {/* Action Required - Denied insurance claims needing resolution */}
            {user && (
              <ActionRequiredSlices userId={user.id} />
            )}
            
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
                totalSpent={totalSpent + medicalSpending}
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
            
            {/* Pet Personality Quiz CTA - Show for first pet without completed quiz */}
            {(() => {
              const petWithoutQuiz = pets.find(p => !p.personality_quiz_completed);
              return petWithoutQuiz ? (
                <motion.div custom={isPawPassSubscriber ? 3.5 : 2.5} variants={cardVariants} initial="hidden" animate="visible">
                  <PersonalityQuizCTA petId={petWithoutQuiz.id} petName={petWithoutQuiz.name} />
                </motion.div>
              ) : null;
            })()}
            
            {/* Below-the-fold sections use content-visibility for paint savings */}
            {/* Row 3: Pet Timeline - The emotional hook */}
            {user && pets.length > 0 && (
              <div className="content-auto">
                <motion.div custom={isPawPassSubscriber ? 4 : 3} variants={cardVariants} initial="hidden" animate="visible">
                  <TimelineTeaser 
                    userId={effectiveWalletUserId || user.id} 
                    pets={pets.map(p => ({ id: p.id, name: p.name }))} 
                  />
                </motion.div>
              </div>
            )}
            
            {/* Row 3.5: Loyalty Rewards - Outcome-first rewards */}
            {user && (
              <div className="content-auto-sm">
                <motion.div custom={isPawPassSubscriber ? 4.5 : 3.5} variants={cardVariants} initial="hidden" animate="visible">
                  <LoyaltyDashboardWidget userId={effectiveWalletUserId || user.id} />
                </motion.div>
              </div>
            )}
            
            {/* Row 3.6: Merchant Loyalty Punch Cards */}
            {user && (
              <div className="content-auto-sm">
                <motion.div custom={isPawPassSubscriber ? 4.6 : 3.6} variants={cardVariants} initial="hidden" animate="visible">
                  <CustomerLoyaltyCards userId={effectiveWalletUserId || user.id} compact />
                </motion.div>
              </div>
            )}
            
            {/* Row 3.7: Discover Merchants with Loyalty Programs */}
            {user && (
              <div className="content-auto-sm">
                <motion.div custom={isPawPassSubscriber ? 4.7 : 3.7} variants={cardVariants} initial="hidden" animate="visible">
                  <LoyaltyProgramDiscovery userId={effectiveWalletUserId || user.id} />
                </motion.div>
              </div>
            )}
            
            {/* Row 4: Guilt-Free Badges - Gamification hook */}
            {user && (
              <div className="content-auto-sm">
                <motion.div custom={isPawPassSubscriber ? 5 : 4} variants={cardVariants} initial="hidden" animate="visible">
                  <BadgeTeaser userId={effectiveWalletUserId || user.id} />
                </motion.div>
              </div>
            )}
            
            {/* Row 4: My Invoices - Shows invoices sent to this pet owner */}
            {user?.email && (
              <motion.div custom={isPawPassSubscriber ? 5 : 4} variants={cardVariants} initial="hidden" animate="visible">
                <PetOwnerInvoices userEmail={user.email} />
              </motion.div>
            )}
            
            {/* Row 5: Share PawBucks - Full Width */}
            <motion.div custom={isPawPassSubscriber ? 6 : 5} variants={cardVariants} initial="hidden" animate="visible">
              <SharePawBucksCard />
            </motion.div>
            
            {/* Row 6: Referral Program & Discover Pet Services - Side by Side on larger screens */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              <motion.div custom={isPawPassSubscriber ? 7 : 6} variants={cardVariants} initial="hidden" animate="visible">
                <ReferralCard />
              </motion.div>
              
              <motion.div custom={isPawPassSubscriber ? 8 : 7} variants={cardVariants} initial="hidden" animate="visible">
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
      <MaximusChat />
      
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
