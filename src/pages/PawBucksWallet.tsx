import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { BottomNav } from "@/components/BottomNav";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { Coins, TrendingUp, Gift, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

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

const PawBucksWallet = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data: wallet, isLoading: walletLoading } = useOptimizedQuery<PawBucksWallet | null>(
    ['pawbucks-wallet', user?.id || ''],
    async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('pawbucks_wallet')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    { staleTime: 1000 * 30 }
  );

  const { data: activities = [], isLoading: activitiesLoading } = useOptimizedQuery<PawBucksActivity[]>(
    ['pawbucks-activity', user?.id || ''],
    async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('pawbucks_activity')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    { staleTime: 1000 * 30 }
  );

  const loading = walletLoading || activitiesLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Calculate progress to next reward level (every 100 coins = $10 credit)
  // Conversion rate: 10 PawBucks = $1.00
  const rewardThreshold = 100;
  const balance = wallet?.balance || 0;
  const usdValue = (balance / 10).toFixed(2);
  const coinsToNextReward = rewardThreshold - (balance % rewardThreshold);
  const progressPercent = ((balance % rewardThreshold) / rewardThreshold) * 100;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-hero)] pb-24">
        <Header isAuthenticated={true} onLogout={handleSignOut} />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)] pb-24">
      <Header isAuthenticated={true} onLogout={handleSignOut} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Coins className="w-10 h-10 text-yellow-500" />
            <h2 className="text-4xl font-bold">Your PawBucks Wallet</h2>
          </div>
          <p className="text-muted-foreground text-lg">Earn 10 PawBucks for every dollar you spend! 🐾</p>
        </div>

        {/* Main Wallet Card */}
        <GradientCard gradient className="mb-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Coins className="w-8 h-8 text-yellow-400" />
              <p className="text-sm text-muted-foreground">Current Balance</p>
            </div>
            <p className="text-6xl font-bold mb-2">{balance.toLocaleString()}</p>
            <p className="text-2xl text-muted-foreground">PawBucks</p>
            <p className="text-lg text-accent mt-2">≈ ${usdValue} USD</p>
          </div>

          {/* Progress to Next Reward */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress to $10 Credit</span>
              <span className="font-semibold">{coinsToNextReward} PawBucks to go</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-center text-muted-foreground mt-2">10 PawBucks = $1.00</p>
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
                  {activities.filter(a => a.type === 'earn').reduce((sum, a) => sum + a.amount, 0).toLocaleString()}
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
                  {Math.abs(activities.filter(a => a.type === 'redeem').reduce((sum, a) => sum + a.amount, 0)).toLocaleString()}
                </p>
              </div>
            </div>
          </GradientCard>
        </div>

        {/* CTA Buttons */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            onClick={() => navigate("/pawbucks/buy")}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold px-8"
          >
            <Coins className="w-5 h-5 mr-2" />
            Buy PawBucks
          </Button>
          <Button 
            size="lg" 
            onClick={() => navigate("/pawbucks/redeem")}
            variant="outline"
            className="font-semibold px-8"
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
                      activity.type === 'earn' ? 'bg-green-500/10' : 'bg-orange-500/10'
                    }`}>
                      {activity.type === 'earn' ? (
                        <ArrowDownRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-orange-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${
                      activity.type === 'earn' ? 'text-green-500' : 'text-orange-500'
                    }`}>
                      {activity.type === 'earn' ? '+' : ''}{activity.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{activity.source}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Coins className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">No activity yet</p>
              <p className="text-sm text-muted-foreground">Start shopping to earn PawBucks! 🐾</p>
              <Button onClick={() => navigate("/discover")} className="mt-4">
                Discover Merchants
              </Button>
            </div>
          )}
        </GradientCard>
      </main>

      <BottomNav />
    </div>
  );
};

export default PawBucksWallet;
