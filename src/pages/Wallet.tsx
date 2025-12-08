import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { DataLoader } from "@/lib/dataLoader";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/gradient-card";
import { BottomNav } from "@/components/BottomNav";
import { AdPlacement } from "@/components/AdPlacement";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { Wallet as WalletIcon, TrendingUp, Gift, ArrowUpRight, ArrowDownRight, Coins, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type WalletData = {
  balance: number;
  rewards_points: number;
  total_spent: number;
};

type Transaction = {
  id: string;
  amount: number;
  cashback_earned: number;
  rewards_earned: number;
  description: string;
  created_at: string;
  merchant_id: string;
};

type PawBucksActivity = {
  id: string;
  amount: number;
  type: string;
  source: string;
  description: string | null;
  created_at: string;
};

const Wallet = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Optimized data loading with caching
  const { data: wallet, isLoading: walletLoading } = useOptimizedQuery<WalletData | null>(
    ['wallet', user?.id || ''],
    () => user ? DataLoader.loadWalletData(user.id) : Promise.resolve(null),
    { staleTime: 1000 * 60 * 2 } // Cache for 2 minutes
  );

  // Fetch PawBucks wallet balance separately
  const { data: pawbucksWallet, isLoading: pawbucksLoading } = useOptimizedQuery<{ balance: number } | null>(
    ['pawbucks_wallet', user?.id || ''],
    async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    { staleTime: 1000 * 60 * 2 }
  );

  const { data: transactions = [], isLoading: transactionsLoading } = useOptimizedQuery<Transaction[]>(
    ['transactions', user?.id || ''],
    () => user ? DataLoader.loadTransactions(user.id, 10) : Promise.resolve([]),
    { staleTime: 1000 * 60 * 2 }
  );

  // Fetch PawBucks activity history
  const { data: pawbucksActivity = [], isLoading: activityLoading } = useOptimizedQuery<PawBucksActivity[]>(
    ['pawbucks_activity', user?.id || ''],
    async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('pawbucks_activity')
        .select('id, amount, type, source, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    { staleTime: 1000 * 60 * 2 }
  );

  const loading = walletLoading || pawbucksLoading || transactionsLoading || activityLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/auth");
  }, [signOut, navigate]);

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
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <Header isAuthenticated={true} onLogout={handleSignOut} />

      <main className="container mx-auto px-4 pt-6 pb-24 md:pb-12 max-w-7xl">
        {/* Ad Placement for Free Users */}
        <div className="mb-6">
          <AdPlacement />
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Wallet</h2>
          <p className="text-muted-foreground">Track your rewards and spending</p>
        </div>

        {/* Wallet Overview */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <GradientCard gradient>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <WalletIcon className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                {/* Show USD value of PawBucks (1000 PawBucks = $1) */}
                <p className="text-2xl font-bold">${((pawbucksWallet?.balance || 0) / 1000).toFixed(2)}</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">${wallet?.total_spent?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <Gift className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Points</p>
                <p className="text-2xl font-bold">{pawbucksWallet?.balance || 0}</p>
              </div>
            </div>
          </GradientCard>
        </div>

        {/* Recent Transactions */}
        <GradientCard>
          <h3 className="text-xl font-semibold mb-4">Recent Transactions</h3>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">-${transaction.amount.toFixed(2)}</p>
                    {/* cashback_earned is in PawBucks, show as PawBucks earned */}
                    <p className="text-xs text-accent">+{transaction.cashback_earned} PawBucks</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <WalletIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">No transactions yet</p>
              <Button onClick={() => navigate("/discover")}>
                Start Shopping
              </Button>
            </div>
          )}
        </GradientCard>

        {/* PawBucks Earning History */}
        <GradientCard className="mt-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-accent" />
            PawBucks History
          </h3>
          {pawbucksActivity.length > 0 ? (
            <div className="space-y-3">
              {pawbucksActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      activity.type === 'earn' ? 'bg-accent/10' : 'bg-destructive/10'
                    }`}>
                      {activity.type === 'earn' ? (
                        <Sparkles className="w-5 h-5 text-accent" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {activity.description || activity.source}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      activity.type === 'earn' ? 'text-accent' : 'text-destructive'
                    }`}>
                      {activity.type === 'earn' ? '+' : '-'}{activity.amount} PawBucks
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {activity.source.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Coins className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">No PawBucks activity yet</p>
              <p className="text-sm text-muted-foreground">
                Earn PawBucks by making purchases at partner merchants!
              </p>
            </div>
          )}
        </GradientCard>

        {/* Bottom Ad Placement */}
        <div className="mt-8 mb-6">
          <AdPlacement position="bottom" />
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Wallet;