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
import { LogOut, Wallet as WalletIcon, TrendingUp, Gift, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
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

const Wallet = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Optimized data loading with caching
  const { data: wallet, isLoading: walletLoading } = useOptimizedQuery<WalletData | null>(
    ['wallet', user?.id || ''],
    () => user ? DataLoader.loadWalletData(user.id) : Promise.resolve(null),
    { staleTime: 1000 * 60 * 2 } // Cache for 2 minutes
  );

  const { data: transactions = [], isLoading: transactionsLoading } = useOptimizedQuery<Transaction[]>(
    ['transactions', user?.id || ''],
    () => user ? DataLoader.loadTransactions(user.id, 10) : Promise.resolve([]),
    { staleTime: 1000 * 60 * 2 }
  );

  const loading = walletLoading || transactionsLoading;

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
          <p className="text-muted-foreground">Track your cashback and spending</p>
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
                <p className="text-2xl font-bold">${wallet?.balance?.toFixed(2) || "0.00"}</p>
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
                <p className="text-2xl font-bold">{wallet?.rewards_points || 0}</p>
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
                    <p className="text-xs text-accent">+${transaction.cashback_earned.toFixed(2)}</p>
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