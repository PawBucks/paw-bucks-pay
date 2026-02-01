import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { usePawBucksRealtime } from "@/hooks/usePawBucksRealtime";
import { useSharedAccount, getEffectiveWalletUserId } from "@/hooks/useSharedAccount";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { BottomNav } from "@/components/BottomNav";
import { AdPlacement } from "@/components/AdPlacement";
import { PageLoader } from "@/components/PageLoader";
import { EmptyState } from "@/components/EmptyState";
import { PawBucksInfoTooltip } from "@/components/PawBucksInfoTooltip";
import { Coins, TrendingUp, Gift, ArrowUpRight, ArrowDownRight, Sparkles, Zap, Crown, Lock, Unlock } from "lucide-react";
import { Formatters } from "@/utils/formatters";
import { PAWBUCKS_CONVERSION, ROUTES, CASHBACK_RATES } from "@/lib/constants";
import { Progress } from "@/components/ui/progress";
import { LockedRewardsCard } from "@/components/wallet/LockedRewardsCard";
import { useSpendablePawBucks } from "@/hooks/useSpendablePawBucks";

type PawBucksWallet = {
  id: string;
  balance: number;
  last_updated: string;
};

type PawBucksActivity = {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  source: string;
};

// Animated Upgrade Prompt Component
const UpgradePrompt = ({ totalEarned, onUpgrade }: { totalEarned: number; onUpgrade: () => void }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'pawpass' | 'pawpassplus'>('pawpass');

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Calculate what they would have earned with each tier
  // Current multipliers: 10x (Free), 20x (PawPass), 30x (PawPass+)
  const basePurchaseAmount = totalEarned / CASHBACK_RATES.FREE; // Reverse calculate purchases (e.g., 100 PawBucks / 10 = $10 spent)
  const pawPassEarnings = Math.round(basePurchaseAmount * CASHBACK_RATES.PAWPASS);
  const pawPassPlusEarnings = Math.round(basePurchaseAmount * CASHBACK_RATES.PAWPASS_PLUS);
  
  const pawPassExtra = pawPassEarnings - totalEarned;
  const pawPassPlusExtra = pawPassPlusEarnings - totalEarned;

  // Example projections for $100, $500, $1000 monthly spend
  const projections = [
    { spend: 100, free: 100, pawpass: 200, pawpassplus: 300 },
    { spend: 500, free: 500, pawpass: 1000, pawpassplus: 1500 },
    { spend: 1000, free: 1000, pawpass: 2000, pawpassplus: 3000 },
  ];

  return (
    <div 
      className={`mb-8 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <GradientCard className="relative overflow-hidden border-2 border-primary/20">
        {/* Animated background shimmer */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" 
          style={{ backgroundSize: '200% 100%' }} 
        />
        
        <div className="relative z-10">
          {/* Header with sparkle animation */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
            <h3 className="text-lg font-bold text-center">Earn More PawBucks!</h3>
            <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
          </div>

          {/* Tier Toggle */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-muted/50 rounded-full p-1">
              <button
                onClick={() => setActiveTab('pawpass')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === 'pawpass' 
                    ? 'bg-yellow-500 text-yellow-950 shadow-lg' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Zap className="w-4 h-4 inline mr-1" />
                PawPass
              </button>
              <button
                onClick={() => setActiveTab('pawpassplus')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === 'pawpassplus' 
                    ? 'bg-purple-500 text-white shadow-lg' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Crown className="w-4 h-4 inline mr-1" />
                PawPass+
              </button>
            </div>
          </div>

          {/* Animated Content based on selected tab */}
          <div className="transition-all duration-300">
            {activeTab === 'pawpass' ? (
              <div className="space-y-4 animate-fade-in">
                {/* What you missed section */}
                {totalEarned > 0 && pawPassExtra > 0 && (
                  <div className="text-center p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm text-muted-foreground mb-1">With PawPass, you would have earned</p>
                    <p className="text-3xl font-bold text-yellow-500">
                      +{Formatters.number(pawPassExtra)} more
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PawBucks from your purchases</p>
                  </div>
                )}

                {/* Rate comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Free Tier</p>
                    <p className="text-lg font-semibold">$1 = 10</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-xs text-yellow-600 font-medium">PawPass (2x)</p>
                    <p className="text-lg font-bold text-yellow-600">$1 = 20</p>
                  </div>
                </div>

                {/* Projection table */}
                <div className="overflow-hidden rounded-lg border border-border/50">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Monthly Spend</th>
                        <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Free</th>
                        <th className="py-2 px-3 text-center text-xs font-medium text-yellow-600">PawPass</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projections.map((p, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="py-2 px-3 font-medium">${p.spend}</td>
                          <td className="py-2 px-3 text-center text-muted-foreground">{Formatters.number(p.free)}</td>
                          <td className="py-2 px-3 text-center font-semibold text-yellow-600">{Formatters.number(p.pawpass)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Only $10/month • 7-day free trial
                </p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {/* What you missed section */}
                {totalEarned > 0 && pawPassPlusExtra > 0 && (
                  <div className="text-center p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <p className="text-sm text-muted-foreground mb-1">With PawPass+, you would have earned</p>
                    <p className="text-3xl font-bold text-purple-500">
                      +{Formatters.number(pawPassPlusExtra)} more
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PawBucks from your purchases</p>
                  </div>
                )}

                {/* Rate comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Free Tier</p>
                    <p className="text-lg font-semibold">$1 = 10</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <p className="text-xs text-purple-500 font-medium">PawPass+ (3x)</p>
                    <p className="text-lg font-bold text-purple-500">$1 = 30</p>
                  </div>
                </div>

                {/* Projection table */}
                <div className="overflow-hidden rounded-lg border border-border/50">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Monthly Spend</th>
                        <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Free</th>
                        <th className="py-2 px-3 text-center text-xs font-medium text-purple-500">PawPass+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projections.map((p, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="py-2 px-3 font-medium">${p.spend}</td>
                          <td className="py-2 px-3 text-center text-muted-foreground">{Formatters.number(p.free)}</td>
                          <td className="py-2 px-3 text-center font-semibold text-purple-500">{Formatters.number(p.pawpassplus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Crown className="w-4 h-4 text-purple-500" />
                  <span>$20/month • 7-day free trial • <span className="text-purple-500 font-medium">Ad-Free!</span></span>
                </div>
              </div>
            )}
          </div>

          {/* CTA Button */}
          <Button 
            onClick={onUpgrade}
            className={`w-full mt-4 font-semibold transition-all duration-300 ${
              activeTab === 'pawpass'
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-yellow-950'
                : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white'
            }`}
          >
            {activeTab === 'pawpass' ? (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Upgrade to PawPass
              </>
            ) : (
              <>
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to PawPass+
              </>
            )}
          </Button>
        </div>
      </GradientCard>
    </div>
  );
};

const PawBucksWallet = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  
  // Check if user is PawPass+ subscriber (product ID for PawPass+)
  const isPawPassPlusSubscriber = subscription.subscribed && subscription.product_id === 'prod_TQyZjYzt9DwoIK';
  
  // Check if user is part of a shared account
  const sharedAccount = useSharedAccount(user?.id);
  const effectiveWalletUserId = getEffectiveWalletUserId(user?.id, sharedAccount);
  
  // Enable realtime updates for PawBucks (use effective user ID)
  usePawBucksRealtime(effectiveWalletUserId);

  const { data: wallet, isLoading: walletLoading } = useOptimizedQuery<PawBucksWallet | null>(
    ['pawbucks-wallet', effectiveWalletUserId || ''],
    async () => {
      if (!effectiveWalletUserId) return null;
      const { data, error } = await supabase
        .from('pawbucks_wallet')
        .select('*')
        .eq('user_id', effectiveWalletUserId)
        .single();
      
      if (error) throw error;
      return data;
    },
    { staleTime: 1000 * 30, enabled: !sharedAccount.isLoading }
  );

  const { data: activities = [], isLoading: activitiesLoading } = useOptimizedQuery<PawBucksActivity[]>(
    ['pawbucks-activity', effectiveWalletUserId || ''],
    async () => {
      if (!effectiveWalletUserId) return [];
      const { data, error } = await supabase
        .from('pawbucks_activity')
        .select('*')
        .eq('user_id', effectiveWalletUserId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    { staleTime: 1000 * 30, enabled: !sharedAccount.isLoading }
  );

  const loading = sharedAccount.isLoading || walletLoading || activitiesLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Calculate progress to next reward level
  const balance = wallet?.balance || 0;
  const usdValue = Formatters.pawBucksToUSD(balance);
  const coinsToNextReward = PAWBUCKS_CONVERSION.REWARD_THRESHOLD - (balance % PAWBUCKS_CONVERSION.REWARD_THRESHOLD);
  const progressPercent = ((balance % PAWBUCKS_CONVERSION.REWARD_THRESHOLD) / PAWBUCKS_CONVERSION.REWARD_THRESHOLD) * 100;

  if (authLoading || loading) {
    return <PageLoader message="Loading your PawBucks wallet..." />;
  }

  return (
    <>
      <SEO 
        title="PawBucks Wallet - Your Rewards"
        description="View your PawBucks balance, track reward history, and redeem rewards for discounts."
        keywords={["PawBucks wallet", "pet rewards", "reward balance"]}
        noIndex={true}
      />
      <div className="min-h-screen bg-[var(--gradient-hero)]">
        <Header isAuthenticated={true} onLogout={handleSignOut} />

      <main className="container mx-auto px-4 pt-6 pb-24 md:pb-12 max-w-7xl">
        {/* Ad Placement for Free Users */}
        <div className="mb-6">
          <AdPlacement />
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Coins className="w-10 h-10 text-yellow-500" />
            <h2 className="text-4xl font-bold">Your PawBucks Wallet</h2>
            <PawBucksInfoTooltip variant="earning" className="ml-1" />
          </div>
          <p className="text-muted-foreground text-lg">Free: $1 = 10 PawBucks • PawPass: $1 = 20 PawBucks • PawPass+: $1 = 30 PawBucks 🐾</p>
        </div>

        {/* Locked Rewards Card - Shows spendable vs locked breakdown */}
        {effectiveWalletUserId && (
          <div className="mb-8">
            <LockedRewardsCard userId={effectiveWalletUserId} />
          </div>
        )}

        {/* Main Wallet Card */}
        <GradientCard gradient className="mb-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Unlock className="w-6 h-6 text-primary" />
              <p className="text-sm text-muted-foreground">Spendable Balance</p>
            </div>
            <p className="text-6xl font-bold mb-2">{Formatters.number(balance)}</p>
            <p className="text-2xl text-muted-foreground">PawBucks</p>
            <p className="text-lg text-accent mt-2">≈ {usdValue}</p>
          </div>

          {/* Progress to Next Reward */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress to $10 Credit</span>
              <span className="font-semibold">{coinsToNextReward} PawBucks to go</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-center text-muted-foreground mt-2 flex items-center justify-center gap-1">
              {PAWBUCKS_CONVERSION.PET_OWNER_TO_USD} PawBucks = $1.00
              <PawBucksInfoTooltip variant="redemption" />
            </p>
          </div>
        </GradientCard>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <GradientCard>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold">
                  {Formatters.number(activities.filter(a => a.type === 'earn' || a.type === 'credit').reduce((sum, a) => sum + a.amount, 0))}
                </p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <Gift className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Redeemed</p>
                <p className="text-2xl font-bold">
                  {Formatters.number(Math.abs(activities.filter(a => a.type === 'redeem').reduce((sum, a) => sum + a.amount, 0)))}
                </p>
              </div>
            </div>
        </GradientCard>
        </div>

        {/* Animated Upgrade Prompt - Only show for non-PawPass+ subscribers */}
        {!isPawPassPlusSubscriber && (
          <UpgradePrompt 
            totalEarned={activities.filter(a => a.type === 'earn' || a.type === 'credit').reduce((sum, a) => sum + a.amount, 0)} 
            onUpgrade={() => navigate(ROUTES.PROFILE)}
          />
        )}

        {/* CTA Buttons */}
        <div className="mb-8 flex justify-center">
          <Button 
            size="lg" 
            onClick={() => navigate(ROUTES.PAWBUCKS_REDEEM)}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold px-8"
          >
            <Gift className="w-5 h-5 mr-2" />
            Redeem PawBucks
          </Button>
        </div>

        {/* Recent Activity */}
        <GradientCard>
          <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      activity.type === 'earn' || activity.type === 'credit' ? 'bg-green-500/10' : 'bg-orange-500/10'
                    }`}>
                      {activity.type === 'earn' || activity.type === 'credit' ? (
                        <ArrowDownRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-orange-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {Formatters.date(activity.created_at, 'relative')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${
                      activity.type === 'earn' ? 'text-green-500' : 'text-orange-500'
                    }`}>
                      {activity.type === 'earn' ? '+' : ''}{Formatters.number(activity.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{activity.source}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Coins}
              title="No activity yet"
              description="Start shopping to earn PawBucks! Every dollar you spend earns you rewards. 🐾"
              action={{
                label: "Discover Merchants",
                onClick: () => navigate(ROUTES.DISCOVER)
              }}
            />
          )}
        </GradientCard>

        {/* Bottom Ad Placement */}
        <div className="mt-8 mb-6">
          <AdPlacement position="bottom" />
        </div>
      </main>

      <BottomNav />
    </div>
    </>
  );
};

export default PawBucksWallet;
