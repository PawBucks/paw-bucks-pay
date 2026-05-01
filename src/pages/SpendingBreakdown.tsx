import { useCallback, useMemo } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useOptimizedQuery } from"@/hooks/useOptimizedQuery";
import { usePullToRefresh } from"@/hooks/usePullToRefresh";
import { useSharedAccount, getEffectiveWalletUserId } from"@/hooks/useSharedAccount";
import { supabase } from"@/integrations/supabase/client";
import { Header } from"@/components/Header";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { BottomNav } from"@/components/BottomNav";
import { AdPlacement } from"@/components/AdPlacement";
import { DashboardSkeleton } from"@/components/LoadingSkeleton";
import { PullToRefresh } from"@/components/PullToRefresh";
import { ArrowLeft, ArrowUpRight, ShoppingBag } from"lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from"date-fns";
import { useQueryClient } from"@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from"recharts";
import { CATEGORY_CONFIG, getNormalizedCategory } from"@/lib/categoryMapping";

import { Formatters } from "@/utils/formatters";
type TransactionWithMerchant = {
 id: string;
 amount: number;
 rewards_earned: number;
 description: string | null;
 created_at: string;
 merchant_id: string;
 merchants: {
 business_name: string;
 business_type: string;
 logo_url: string | null;
 } | null;
};

type MedicalRecord = {
 id: string;
 title: string;
 price: number;
 record_date: string;
 record_type: string;
};

const SpendingBreakdown = () => {
 const { user, signOut, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 
 // Get shared account info for wallet queries
 const sharedAccount = useSharedAccount(user?.id);
 const effectiveUserId = getEffectiveWalletUserId(user?.id, sharedAccount);

 // Fetch all transactions with merchant info
 const { data: transactions = [], isLoading: transactionsLoading } = useOptimizedQuery<TransactionWithMerchant[]>(
 ['spending-breakdown-transactions', effectiveUserId ||''],
 async () => {
 if (!effectiveUserId) return [];
 
 // First get transactions
 const { data: txData, error: txError } = await supabase
 .from('transactions')
 .select('id, amount, rewards_earned, description, created_at, merchant_id, status')
 .eq('user_id', effectiveUserId)
 .eq('status','completed')
 .order('created_at', { ascending: false });
 if (txError) throw txError;
 
 // Get unique merchant IDs
 const merchantIds = [...new Set((txData || []).map(t => t.merchant_id).filter(Boolean))];
 
 // Fetch merchants from public view
 let merchantMap: Record<string, { business_name: string; business_type: string; logo_url: string | null }> = {};
 if (merchantIds.length > 0) {
 const { data: merchants } = await supabase
 .from('merchants_public')
 .select('id, business_name, business_type, logo_url')
 .in('id', merchantIds);
 
 merchants?.forEach((m: any) => {
 merchantMap[m.id] = { business_name: m.business_name, business_type: m.business_type, logo_url: m.logo_url };
 });
 }
 
 // Combine data
 return (txData || []).map(tx => ({
 ...tx,
 merchants: merchantMap[tx.merchant_id] || null
 })) as TransactionWithMerchant[];
 },
 { staleTime: 1000 * 60 * 5 }
 );

 // Fetch medical records with prices (vet spending)
 const { data: medicalRecords = [], isLoading: medicalLoading } = useOptimizedQuery<MedicalRecord[]>(
 ['spending-breakdown-medical', effectiveUserId ||''],
 async () => {
 if (!effectiveUserId) return [];
 const { data, error } = await supabase
 .from('pet_medical_records')
 .select('id, title, price, record_date, record_type')
 .eq('user_id', effectiveUserId)
 .not('price','is', null)
 .order('record_date', { ascending: false });
 if (error) throw error;
 return (data || []) as MedicalRecord[];
 },
 { staleTime: 1000 * 60 * 5 }
 );

 const isLoading = transactionsLoading || medicalLoading || sharedAccount.isLoading;

 // Calculate spending by category (including medical records as veterinary)
 const categoryBreakdown = useMemo(() => {
 const breakdown: Record<string, number> = {};
 
 // Add transactions using the normalized category mapping
 transactions.forEach(tx => {
 const normalizedCategory = getNormalizedCategory(tx.merchants?.business_type);
 breakdown[normalizedCategory] = (breakdown[normalizedCategory] || 0) + tx.amount;
 });

 // Add medical records to veterinary category
 const medicalTotal = medicalRecords.reduce((sum, record) => sum + (record.price || 0), 0);
 if (medicalTotal > 0) {
 breakdown['veterinary'] = (breakdown['veterinary'] || 0) + medicalTotal;
 }

 return Object.entries(breakdown)
 .map(([category, amount]) => ({
 name: CATEGORY_CONFIG[category]?.label || category.charAt(0).toUpperCase() + category.slice(1),
 value: amount,
 color: CATEGORY_CONFIG[category]?.color || CATEGORY_CONFIG.other.color,
 category,
 }))
 .sort((a, b) => b.value - a.value);
 }, [transactions, medicalRecords]);

 // Calculate monthly spending trends (last 6 months) - including medical records
 const monthlyTrends = useMemo(() => {
 const trends: { month: string; amount: number }[] = [];
 const now = new Date();

 for (let i = 5; i >= 0; i--) {
 const monthDate = subMonths(now, i);
 const monthStart = startOfMonth(monthDate);
 const monthEnd = endOfMonth(monthDate);

 // Transaction spending for the month
 const txTotal = transactions
 .filter(tx => {
 const txDate = new Date(tx.created_at);
 return txDate >= monthStart && txDate <= monthEnd;
 })
 .reduce((sum, tx) => sum + tx.amount, 0);

 // Medical records spending for the month
 const medicalTotal = medicalRecords
 .filter(record => {
 const recordDate = new Date(record.record_date);
 return recordDate >= monthStart && recordDate <= monthEnd;
 })
 .reduce((sum, record) => sum + (record.price || 0), 0);

 trends.push({
 month: format(monthDate,'MMM'),
 amount: txTotal + medicalTotal,
 });
 }

 return trends;
 }, [transactions, medicalRecords]);

 // Calculate totals (transactions + medical records)
 const totalSpending = useMemo(() => {
 const txTotal = transactions.reduce((sum, tx) => sum + tx.amount, 0);
 const medicalTotal = medicalRecords.reduce((sum, record) => sum + (record.price || 0), 0);
 return txTotal + medicalTotal;
 }, [transactions, medicalRecords]);

 const totalRewards = useMemo(() => 
 transactions.reduce((sum, tx) => sum + tx.rewards_earned, 0), 
 [transactions]
 );

 const handleSignOut = useCallback(async () => {
 await signOut();
 navigate("/auth");
 }, [signOut, navigate]);

 const handleRefresh = useCallback(async () => {
 await Promise.all([
 queryClient.invalidateQueries({ queryKey: ['spending-breakdown-transactions'] }),
 queryClient.invalidateQueries({ queryKey: ['spending-breakdown-medical'] }),
 ]);
 }, [queryClient]);

 const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
 onRefresh: handleRefresh,
 });

 if (authLoading || isLoading) {
 return (
 <div className="min-h-screen bg-background">
 <Header isAuthenticated={true} onLogout={handleSignOut} userId={user?.id} />
 <main className="container mx-auto px-4 py-8 max-w-4xl">
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
 {/* Ad Placement */}
 <div className="mb-4 sm:mb-6">
 <AdPlacement />
 </div>

 {/* Header with Back Button */}
 <div className="flex items-center gap-3 mb-6">
 <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <div>
 <h2 className="text-2xl sm:text-3xl font-bold">Spending Breakdown</h2>
 <p className="text-sm sm:text-base text-muted-foreground">
 Detailed view of your pet care spending
 </p>
 </div>
 </div>

 {/* Summary Cards */}
 <div className="grid gap-4 grid-cols-2 mb-6">
 <GradientCard gradient>
 <p className="text-sm text-muted-foreground">Total Spending</p>
 <p className="text-2xl sm:text-3xl font-bold">{Formatters.currency(totalSpending)}</p>
 </GradientCard>
 <GradientCard>
 <p className="text-sm text-muted-foreground">Rewards Earned</p>
 <p className="text-2xl sm:text-3xl font-bold text-accent">{totalRewards.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground">PawBucks</p>
 </GradientCard>
 </div>

 {/* Category Breakdown */}
 <GradientCard className="mb-6">
 <h3 className="text-xl font-semibold mb-4">Spending by Category</h3>
 {categoryBreakdown.length > 0 ? (
 <div className="grid md:grid-cols-2 gap-6">
 {/* Pie Chart */}
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={categoryBreakdown}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={90}
 paddingAngle={2}
 dataKey="value"
 >
 {categoryBreakdown.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip 
 formatter={(value: number) => [`${Formatters.currency(value)}`,'Amount']}
 contentStyle={{
 backgroundColor:'hsl(var(--card))',
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px',
 }}
 />
 </PieChart>
 </ResponsiveContainer>
 </div>

 {/* Category List */}
 <div className="space-y-3">
 {categoryBreakdown.map((cat) => {
 const config = CATEGORY_CONFIG[cat.category] || CATEGORY_CONFIG.other;
 const Icon = config.icon;
 const percentage = ((cat.value / totalSpending) * 100).toFixed(1);
 
 return (
 <div key={cat.category} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
 <div className="flex items-center gap-3">
 <div 
 className="w-10 h-10 rounded-full flex items-center justify-center"
 style={{ backgroundColor: `${cat.color}20` }}
 >
 <Icon className="w-5 h-5" style={{ color: cat.color }} />
 </div>
 <div>
 <p className="font-medium">{cat.name}</p>
 <p className="text-xs text-muted-foreground">{percentage}% of total</p>
 </div>
 </div>
 <p className="font-bold">{Formatters.currency(cat.value)}</p>
 </div>
 );
 })}
 </div>
 </div>
 ) : (
 <div className="text-center py-8">
 <p className="text-muted-foreground">No spending data yet</p>
 </div>
 )}
 </GradientCard>

 {/* Monthly Trends */}
 <GradientCard className="mb-6">
 <h3 className="text-xl font-semibold mb-4">Monthly Spending Trends</h3>
 {monthlyTrends.some(m => m.amount > 0) ? (
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={monthlyTrends}>
 <XAxis 
 dataKey="month" 
 axisLine={false}
 tickLine={false}
 tick={{ fill:'hsl(var(--muted-foreground))' }}
 />
 <YAxis 
 axisLine={false}
 tickLine={false}
 tick={{ fill:'hsl(var(--muted-foreground))' }}
 tickFormatter={(value) => `$${value}`}
 />
 <Tooltip 
 formatter={(value: number) => [`${Formatters.currency(value)}`,'Spending']}
 contentStyle={{
 backgroundColor:'hsl(var(--card))',
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px',
 }}
 />
 <Bar 
 dataKey="amount" 
 fill="hsl(var(--primary))" 
 radius={[4, 4, 0, 0]}
 />
 </BarChart>
 </ResponsiveContainer>
 </div>
 ) : (
 <div className="text-center py-8">
 <p className="text-muted-foreground">No spending data for the past 6 months</p>
 </div>
 )}
 </GradientCard>

 {/* Spending History */}
 <GradientCard>
 <h3 className="text-xl font-semibold mb-4">Spending History</h3>
 {(transactions.length > 0 || medicalRecords.length > 0) ? (
 <div className="space-y-3">
 {/* Combine and sort all spending items by date */}
 {[
 ...transactions.map(tx => ({
 id: tx.id,
 type:'transaction' as const,
 amount: tx.amount,
 date: tx.created_at,
 title: tx.merchants?.business_name || tx.description ||'Transaction',
 category: tx.merchants?.business_type?.toLowerCase() ||'other',
 rewards: tx.rewards_earned,
 })),
 ...medicalRecords.map(record => ({
 id: record.id,
 type:'medical' as const,
 amount: record.price,
 date: record.record_date,
 title: record.title,
 category:'veterinary',
 rewards: 0,
 })),
 ]
 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
 .slice(0, 30)
 .map((item) => {
 const normalizedCategory = getNormalizedCategory(item.category);
 const config = CATEGORY_CONFIG[normalizedCategory] || CATEGORY_CONFIG.other;
 const Icon = config.icon;

 return (
 <div
 key={item.id}
 className="flex items-center justify-between p-4 rounded-md bg-muted/30 border border-border/50 hover:bg-muted transition-colors"
 >
 <div className="flex items-center gap-3">
 <div 
 className="w-10 h-10 rounded-full flex items-center justify-center"
 style={{ backgroundColor: `${config.color}20` }}
 >
 <Icon className="w-5 h-5" style={{ color: config.color }} />
 </div>
 <div>
 <p className="font-medium">{item.title}</p>
 <p className="text-xs text-muted-foreground">
 {format(new Date(item.date),"MMM d, yyyy")} • {config.label}
 {item.type ==='medical' &&' (Vet Record)'}
 </p>
 </div>
 </div>
 <div className="text-right">
 <p className="font-bold">-{Formatters.currency(item.amount)}</p>
 {item.rewards > 0 && (
 <p className="text-xs text-accent">+{item.rewards} PawBucks</p>
 )}
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-12">
 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
 <ShoppingBag className="w-8 h-8 text-muted-foreground" />
 </div>
 <p className="text-muted-foreground mb-4">No spending recorded yet</p>
 <Button onClick={() => navigate("/discover")}>
 Start Shopping
 </Button>
 </div>
 )}
 </GradientCard>

 {/* Bottom Ad */}
 <div className="mt-6 sm:mt-8">
 <AdPlacement position="bottom" />
 </div>
 </main>
 </PullToRefresh>

 <BottomNav />
 </div>
 );
};

export default SpendingBreakdown;
