import { useEffect, useMemo, useCallback } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useOptimizedQuery } from"@/hooks/useOptimizedQuery";
import { usePullToRefresh } from"@/hooks/usePullToRefresh";
import { usePawBucksRealtime } from"@/hooks/usePawBucksRealtime";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { DataLoader } from"@/lib/dataLoader";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { BottomNav } from"@/components/BottomNav";
import { AdPlacement } from"@/components/AdPlacement";
import { DashboardSkeleton } from"@/components/LoadingSkeleton";
import { PullToRefresh } from"@/components/PullToRefresh";
import { EnhancedSpendingChart } from"@/components/wallet/EnhancedSpendingChart";
import { MonthlyComparison } from"@/components/wallet/MonthlyComparison";
import { BudgetSettings } from"@/components/wallet/BudgetSettings";
import { YearlySummary } from"@/components/wallet/YearlySummary";
import { PawBucksBreakdown } from"@/components/wallet/PawBucksBreakdown";
import { PetFundCard } from"@/components/wallet/PetFundCard";
import { StoreLockedPawBucksList } from"@/components/wallet/StoreLockedPawBucksList";
import { SpendingInsights } from"@/components/wallet/SpendingInsights";
import { RecurringExpenses } from"@/components/wallet/RecurringExpenses";
import { SpendingGoals } from"@/components/wallet/SpendingGoals";
import { CategoryComparison } from"@/components/wallet/CategoryComparison";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, RotateCcw } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { format } from"date-fns";
import { Formatters } from"@/utils/formatters";
import { useQueryClient } from"@tanstack/react-query";

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
 status: string;
 merchants?: {
 business_type: string;
 business_name: string;
 } | null;
};

type BudgetTransaction = {
 id: string;
 amount: number;
 created_at: string;
 merchants?: {
 business_type: string;
 } | null;
};

type PawBucksActivity = {
 id: string;
 amount: number;
 type: string;
 source: string;
 description: string | null;
 created_at: string;
};

type MedicalRecord = {
 id: string;
 price: number | null;
 record_date: string;
 title: string;
};

const Wallet = () => {
 const { user, signOut, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 
 // Check if user is part of a shared account
 const sharedAccount = useSharedAccount(user?.id);
 const effectiveWalletUserId = getEffectiveWalletUserId(user?.id, sharedAccount);
 
 // Enable realtime updates for PawBucks (use effective user ID)
 usePawBucksRealtime(effectiveWalletUserId);

 // Optimized data loading with caching - using effective wallet user ID
 const { data: wallet, isLoading: walletLoading } = useOptimizedQuery<WalletData | null>(
 ['wallet', effectiveWalletUserId ||''],
 () => effectiveWalletUserId ? DataLoader.loadWalletData(effectiveWalletUserId) : Promise.resolve(null),
 { staleTime: 1000 * 60 * 2, enabled: !sharedAccount.isLoading }
 );

 // Fetch PawBucks wallet balance separately - using effective wallet user ID
 const { data: pawbucksWallet, isLoading: pawbucksLoading } = useOptimizedQuery<{ balance: number } | null>(
 ['pawbucks_wallet', effectiveWalletUserId ||''],
 async () => {
 if (!effectiveWalletUserId) return null;
 const { data, error } = await supabase
 .from('pawbucks_wallet')
 .select('balance')
 .eq('user_id', effectiveWalletUserId)
 .maybeSingle();
 if (error) throw error;
 return data;
 },
 { staleTime: 1000 * 60 * 2, enabled: !sharedAccount.isLoading }
 );

 const { data: transactions = [], isLoading: transactionsLoading } = useOptimizedQuery<Transaction[]>(
 ['transactions', effectiveWalletUserId ||''],
 () => effectiveWalletUserId ? DataLoader.loadTransactions(effectiveWalletUserId, 10) : Promise.resolve([]),
 { staleTime: 1000 * 60 * 2, enabled: !sharedAccount.isLoading }
 );

 // Fetch all transactions for current month for budget tracking
 const { data: budgetTransactions = [], isLoading: budgetTransactionsLoading } = useOptimizedQuery<BudgetTransaction[]>(
 ['budget-transactions', effectiveWalletUserId ||''],
 () => effectiveWalletUserId ? DataLoader.loadTransactionsForBudget(effectiveWalletUserId) : Promise.resolve([]),
 { staleTime: 1000 * 60 * 2, enabled: !sharedAccount.isLoading }
 );

 // Fetch medical records to include in spending calculations - using effective wallet user ID
 const { data: medicalRecords = [], isLoading: medicalLoading } = useOptimizedQuery<MedicalRecord[]>(
 ['wallet-medical-records', effectiveWalletUserId ||''],
 async () => {
 if (!effectiveWalletUserId) return [];
 const { data, error } = await supabase
 .from('pet_medical_records')
 .select('id, price, record_date, title')
 .eq('user_id', effectiveWalletUserId)
 .order('record_date', { ascending: false });
 if (error) throw error;
 return data || [];
 },
 { staleTime: 1000 * 60 * 2, enabled: !sharedAccount.isLoading }
 );

 // Fetch PawBucks activity history - using effective wallet user ID
 const { data: pawbucksActivity = [], isLoading: activityLoading } = useOptimizedQuery<PawBucksActivity[]>(
 ['pawbucks_activity', effectiveWalletUserId ||''],
 async () => {
 if (!effectiveWalletUserId) return [];
 const { data, error } = await supabase
 .from('pawbucks_activity')
 .select('id, amount, type, source, description, created_at')
 .eq('user_id', effectiveWalletUserId)
 .order('created_at', { ascending: false })
 .limit(10);
 if (error) throw error;
 return data || [];
 },
 { staleTime: 1000 * 60 * 2, enabled: !sharedAccount.isLoading }
 );

 const loading = sharedAccount.isLoading || walletLoading || pawbucksLoading || transactionsLoading || budgetTransactionsLoading || activityLoading || medicalLoading;

 // Filter to only completed transactions for spending analytics
 const completedTransactions = useMemo(() => 
 transactions.filter(t => t.status ==='completed'), 
 [transactions]
 );

 // Calculate true total spent including medical records (only completed transactions)
 const totalSpent = useMemo(() => {
 const transactionTotal = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
 const medicalTotal = medicalRecords.reduce((sum, record) => sum + (record.price || 0), 0);
 return transactionTotal + medicalTotal;
 }, [completedTransactions, medicalRecords]);

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 const handleSignOut = useCallback(async () => {
 await signOut();
 navigate("/auth");
 }, [signOut, navigate]);

 // Pull to refresh
 const handleRefresh = useCallback(async () => {
 await queryClient.invalidateQueries({ queryKey: ['wallet'] });
 await queryClient.invalidateQueries({ queryKey: ['pawbucks_wallet'] });
 await queryClient.invalidateQueries({ queryKey: ['transactions'] });
 await queryClient.invalidateQueries({ queryKey: ['budget-transactions'] });
 await queryClient.invalidateQueries({ queryKey: ['budget-settings'] });
 await queryClient.invalidateQueries({ queryKey: ['pawbucks_activity'] });
 await queryClient.invalidateQueries({ queryKey: ['wallet-medical-records'] });
 }, [queryClient]);

 const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
 onRefresh: handleRefresh,
 });

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
 <>
 <SEO 
 title="Wallet & Spending - PawBucks"
 description="Track your pet spending, view transaction history, and manage your PawBucks rewards. Budget smarter for your pet's needs."
 keywords={["pet spending tracker","PawBucks wallet","pet budget","pet expenses"]}
 noIndex={true}
 />
 <div className="min-h-[100dvh] bg-[var(--gradient-hero)] flex flex-col">
 <Header isAuthenticated={true} onLogout={handleSignOut} />

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

 {/* Shared Account Banner */}
 {sharedAccount.isSharedMember && sharedAccount.ownerName && (
 <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-primary" />
 <span className="text-sm">
 Viewing shared account with <strong>{sharedAccount.ownerName}</strong>
 </span>
 </div>
 )}

 <div className="mb-6">
 <h2 className="text-2xl sm:text-3xl font-bold mb-1">Wallet</h2>
 <p className="text-sm sm:text-base text-muted-foreground">Track your rewards and spending</p>
 </div>

 {/* Wallet Overview */}
 <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3 mb-6">
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
 <WalletIcon className="w-6 h-6 text-accent" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Balance</p>
 {/* Show USD value of PawBucks (1 PawBuck = $0.001) */}
  <p className="text-2xl font-bold">{Formatters.currency((pawbucksWallet?.balance || 0) * 0.001)}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard>
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
 <span className="w-6 h-6 text-primary" aria-hidden="true">📈</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Spent</p>
  <p className="text-2xl font-bold">{Formatters.currency(totalSpent)}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard>
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
 <span className="w-6 h-6 text-secondary" aria-hidden="true">🎁</span>
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Points</p>
  <p className="text-2xl font-bold">{Formatters.number(pawbucksWallet?.balance || 0)}</p>
 </div>
 </div>
 </GradientCard>
 </div>

 {/* Quarter-Million Pet Fund */}
 {effectiveWalletUserId && (
 <div className="mb-6">
 <PetFundCard userId={effectiveWalletUserId} />
 </div>
 )}

  {/* In-Store Rewards (Store Rewards Pro merchants) */}
  {effectiveWalletUserId && (
    <div className="mb-6">
      <StoreLockedPawBucksList userId={effectiveWalletUserId} />
    </div>
  )}

 {/* PawBucks Available vs Pending Breakdown */}
 {effectiveWalletUserId && (
 <div className="mb-6">
 <PawBucksBreakdown userId={effectiveWalletUserId} />
 </div>
 )}

 {/* Quick Action - View Detailed Breakdown */}
 <div className="mb-6">
 <Button 
 onClick={() => navigate('/spending-breakdown')} 
 variant="outline" 
 className="w-full justify-between"
 >
 <span className="flex items-center gap-2">
 <span className="w-4 h-4" aria-hidden="true">📊</span>
 View Detailed Spending Breakdown
 </span>
 <ArrowUpRight className="w-4 h-4" />
 </Button>
 </div>

 {/* Smart Insights */}
 <div className="mb-6">
 <SpendingInsights transactions={completedTransactions} medicalRecords={medicalRecords} />
 </div>

 {/* Spending Goals & Month Comparison */}
 <div className="grid gap-6 md:grid-cols-2 mb-6">
 <SpendingGoals transactions={completedTransactions} medicalRecords={medicalRecords} />
 <MonthlyComparison transactions={completedTransactions} medicalRecords={medicalRecords} />
 </div>

 {/* Enhanced Spending Chart */}
 <div className="mb-6">
 <EnhancedSpendingChart transactions={completedTransactions} medicalRecords={medicalRecords} />
 </div>

 {/* Category Comparison & Recurring Expenses */}
 <div className="grid gap-6 md:grid-cols-2 mb-6">
 <CategoryComparison transactions={completedTransactions} medicalRecords={medicalRecords} />
 <RecurringExpenses transactions={completedTransactions} />
 </div>

 {/* Budget Settings */}
 <div className="mb-6">
 <BudgetSettings transactions={budgetTransactions} />
 </div>

 {/* Yearly Summary with PDF Download */}
 <div className="mb-6">
 <YearlySummary />
 </div>

 {/* Recent Transactions */}
 <GradientCard>
 <h3 className="text-xl font-semibold mb-4">Recent Transactions</h3>
 {transactions.length > 0 ? (
 <div className="space-y-3">
 {transactions.map((transaction) => {
 const isRefunded = transaction.status ==='refunded';
 return (
 <div
 key={transaction.id}
 className={`flex items-center justify-between p-4 rounded-md border border-border/50 hover:bg-muted transition-colors ${
 isRefunded ?'bg-destructive/5 border-destructive/20' :'bg-muted/30'
 }`}
 >
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
 isRefunded ?'bg-destructive/10' :'bg-primary/10'
 }`}>
 {isRefunded ? (
 <RotateCcw className="w-5 h-5 text-destructive" />
 ) : (
 <ArrowUpRight className="w-5 h-5 text-primary" />
 )}
 </div>
 <div>
 <p className="font-medium">
 {transaction.description}
 {isRefunded && (
 <span className="ml-2 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
 Refunded
 </span>
 )}
 </p>
 <p className="text-xs text-muted-foreground">
 {format(new Date(transaction.created_at),"MMM d, yyyy")}
 </p>
 </div>
 </div>
 <div className="text-right">
 <p className={`font-bold ${isRefunded ?'text-destructive line-through' :'text-foreground'}`}>
  -{Formatters.currency(transaction.amount)}
 </p>
 {/* rewards_earned stores the correct PawBucks amount (amount * multiplier) */}
 <p className={`text-xs ${isRefunded ?'text-destructive line-through' :'text-accent'}`}>
  +{Formatters.number(transaction.rewards_earned ?? 0)} PawBucks
 </p>
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-12">
 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
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
 <span className="w-5 h-5 text-accent" aria-hidden="true">🐾</span>
 PawBucks History
 </h3>
 {pawbucksActivity.length > 0 ? (
 <div className="space-y-3">
 {pawbucksActivity.map((activity) => (
 <div
 key={activity.id}
 className="flex items-center justify-between p-4 rounded-md bg-muted/30 border border-border/50 hover:bg-muted transition-colors"
 >
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
 activity.type ==='earn' ?'bg-accent/10' :'bg-destructive/10'
 }`}>
 {activity.type ==='earn' ? (
 <Sparkles className="w-5 h-5 text-accent" />
 ) : (
 <ArrowDownRight className="w-5 h-5 text-destructive" />
 )}
 </div>
 <div>
 <p className="font-medium">
                        {activity.description || Formatters.activitySource(activity.source)}
 </p>
 <p className="text-xs text-muted-foreground">
 {format(new Date(activity.created_at),"MMM d, yyyy'at' h:mm a")}
 </p>
 </div>
 </div>
 <div className="text-right">
 <p className={`font-bold ${
 activity.type ==='earn' ?'text-accent' :'text-destructive'
 }`}>
 {activity.type ==='earn' ?'+' :'-'}{activity.amount} PawBucks
 </p>
                      <p className="text-xs text-muted-foreground">
                        {Formatters.activitySource(activity.source)}
                      </p>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-12">
 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
 <span className="w-8 h-8 text-muted-foreground" aria-hidden="true">🐾</span>
 </div>
 <p className="text-muted-foreground mb-4">No PawBucks activity yet</p>
 <p className="text-sm text-muted-foreground">
 Earn PawBucks by making purchases at partner merchants!
 </p>
 </div>
 )}
 </GradientCard>

 {/* Bottom Ad Placement */}
 <div className="mt-6 sm:mt-8">
 <AdPlacement position="bottom" />
 </div>
 </main>
 </PullToRefresh>

 <BottomNav />
 </div>
 </>
 );
};

export default Wallet;