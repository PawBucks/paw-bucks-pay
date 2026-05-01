import { useEffect, useState, useCallback } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { useOptimizedQuery } from"@/hooks/useOptimizedQuery";
import { supabase } from"@/integrations/supabase/client";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { PageLoader } from"@/components/PageLoader";
import { Coins, TrendingUp, ArrowUpRight, ArrowDownRight, ArrowLeft, Store, ShoppingBag } from"lucide-react";
import { Formatters } from"@/utils/formatters";
import { format, parseISO } from"date-fns";

import { Formatters } from "@/utils/formatters";
type MerchantPawBucksWallet = {
 id: string;
 balance: number;
 last_updated: string;
 merchant_id: string;
};

type MerchantPawBucksActivity = {
 id: string;
 type: string;
 amount: number;
 description: string | null;
 created_at: string;
 source: string;
};

type Merchant = {
 id: string;
 business_name: string;
};

const MerchantPawBucksWallet = () => {
 const { user, loading: authLoading } = useAuth();
 const navigate = useNavigate();

 // First fetch the merchant data
 const { data: merchant, isLoading: merchantLoading } = useOptimizedQuery<Merchant | null>(
 ['merchant', user?.id ||''],
 async () => {
 if (!user) return null;
 const { data, error } = await supabase
 .from('merchants')
 .select('id, business_name')
 .eq('user_id', user.id)
 .single();
 
 if (error) {
 if (error.code ==='PGRST116') return null; // Not a merchant
 throw error;
 }
 return data;
 },
 { staleTime: 1000 * 60 }
 );

 // Fetch merchant's PawBucks wallet
 const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useOptimizedQuery<MerchantPawBucksWallet | null>(
 ['merchant-pawbucks-wallet', merchant?.id ||''],
 async () => {
 if (!merchant) return null;
 const { data, error } = await supabase
 .from('merchant_pawbucks_wallet')
 .select('*')
 .eq('merchant_id', merchant.id)
 .single();
 
 if (error) {
 if (error.code ==='PGRST116') return null; // No wallet yet
 throw error;
 }
 return data;
 },
 { 
 staleTime: 1000 * 30,
 enabled: !!merchant 
 }
 );

 // Fetch merchant's PawBucks activity
 const { data: activities = [], isLoading: activitiesLoading } = useOptimizedQuery<MerchantPawBucksActivity[]>(
 ['merchant-pawbucks-activity', merchant?.id ||''],
 async () => {
 if (!merchant) return [];
 const { data, error } = await supabase
 .from('merchant_pawbucks_activity')
 .select('*')
 .eq('merchant_id', merchant.id)
 .order('created_at', { ascending: false })
 .limit(20);
 
 if (error) throw error;
 return data || [];
 },
 { 
 staleTime: 1000 * 30,
 enabled: !!merchant 
 }
 );

 const loading = merchantLoading || walletLoading || activitiesLoading;

 useEffect(() => {
 if (!authLoading && !user) {
 navigate("/auth");
 }
 }, [user, authLoading, navigate]);

 // Redirect non-merchants
 useEffect(() => {
 if (!merchantLoading && !merchant && user) {
 navigate("/dashboard");
 }
 }, [merchant, merchantLoading, user, navigate]);

 const balance = wallet?.balance || 0;
 // Merchant PawBucks: 1 PawBuck = $0.001
 const usdValue = balance * 0.001;

 const totalEarned = activities
 .filter(a => a.type ==='earn')
 .reduce((sum, a) => sum + a.amount, 0);

 const totalSpent = Math.abs(
 activities
 .filter(a => a.type ==='spend' || a.type ==='redeem' || a.type ==='debit')
 .reduce((sum, a) => sum + a.amount, 0)
 );

 if (authLoading || loading) {
 return <PageLoader message="Loading your merchant PawBucks wallet..." />;
 }

 if (!merchant) {
 return null;
 }

 return (
 <div className="min-h-screen bg-background">
 {/* Header */}
 <header className="border-b border-border/50 bg-card/95 backdrop-blur-xl sticky top-0 z-50" style={{ paddingTop:'max(0.5rem, env(safe-area-inset-top))' }}>
 <div className="container mx-auto px-4 py-3 flex items-center gap-4">
 <Button 
 variant="ghost" 
 size="icon" 
 onClick={() => navigate('/merchant-dashboard')}
 className="min-h-[44px] min-w-[44px]"
 >
 <ArrowLeft className="w-5 h-5" />
 </Button>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
 <Coins className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h1 className="text-lg font-bold">Merchant PawBucks</h1>
 <p className="text-xs text-muted-foreground">{merchant.business_name}</p>
 </div>
 </div>
 </div>
 </header>

 <main className="container mx-auto px-4 py-6 pb-24 max-w-4xl lg:max-w-5xl">
 {/* Main Balance Card */}
 <GradientCard gradient className="mb-6">
 <div className="text-center">
 <div className="flex items-center justify-center gap-2 mb-2">
 <Coins className="w-8 h-8 text-warning" />
 <p className="text-sm text-muted-foreground">Current Balance</p>
 </div>
 <p className="text-5xl font-bold mb-2">{Formatters.number(balance)}</p>
 <p className="text-xl text-muted-foreground">PawBucks</p>
 <p className="text-lg text-accent mt-2">≈ {Formatters.currency(usdValue)} USD</p>
 <p className="text-xs text-muted-foreground mt-2">1000 PawBucks = $1.00</p>
 </div>
 </GradientCard>

 {/* Quick Stats */}
 <div className="grid grid-cols-2 gap-4 mb-6">
 <GradientCard>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
 <TrendingUp className="w-5 h-5 text-success" />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Total Earned</p>
 <p className="text-lg font-bold">{Formatters.number(totalEarned)}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
 <ShoppingBag className="w-5 h-5 text-info" />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Total Spent</p>
 <p className="text-lg font-bold">{Formatters.number(totalSpent)}</p>
 </div>
 </div>
 </GradientCard>
 </div>

 {/* How Merchants Earn PawBucks */}
 <GradientCard className="mb-6">
 <h3 className="font-semibold mb-3 flex items-center gap-2">
 <Store className="w-4 h-4" />
 How You Earn PawBucks
 </h3>
 <ul className="text-sm text-muted-foreground space-y-2">
 <li className="flex items-start gap-2">
 <span className="text-primary">•</span>
 <span>Receive PawBucks when customers pay with their PawBucks balance</span>
 </li>
 <li className="flex items-start gap-2">
 <span className="text-primary">•</span>
 <span>Use PawBucks to purchase platform services in the Merchant Market</span>
 </li>
 </ul>
 <Button 
 variant="outline" 
 className="w-full mt-4"
 onClick={() => navigate('/merchant/market')}
 >
 <ShoppingBag className="w-4 h-4 mr-2" />
 Browse Merchant Market
 </Button>
 </GradientCard>

 {/* Activity History */}
 <GradientCard>
 <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
 {activities.length > 0 ? (
 <div className="space-y-3">
 {activities.map((activity) => (
 <div
 key={activity.id}
 className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
 >
 <div className="flex items-center gap-3">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
 activity.source ==='refund' ?'bg-destructive/10' :
 activity.type ==='earn' ?'bg-success/10' :'bg-info/10'
 }`}>
 {activity.source ==='refund' ? (
 <ArrowDownRight className="w-4 h-4 text-destructive" />
 ) : activity.type ==='earn' ? (
 <ArrowUpRight className="w-4 h-4 text-success" />
 ) : (
 <ArrowDownRight className="w-4 h-4 text-info" />
 )}
 </div>
 <div>
 <p className="font-medium text-sm">
 {activity.description || (activity.type ==='earn' ?'Earned' :'Spent')}
 {activity.source ==='refund' && (
 <span className="ml-2 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
 Refund
 </span>
 )}
 </p>
 <p className="text-xs text-muted-foreground">
 {format(parseISO(activity.created_at),'MMM d, yyyy h:mm a')}
 </p>
 </div>
 </div>
 <span className={`font-semibold ${
 activity.source ==='refund' ?'text-destructive' :
 activity.type ==='earn' ?'text-success' :'text-info'
 }`}>
 {activity.type ==='earn' ?'+' :'-'}{Formatters.number(Math.abs(activity.amount))}
 </span>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" />
 <p>No activity yet</p>
 <p className="text-sm mt-1">PawBucks will appear here when customers pay with them</p>
 </div>
 )}
 </GradientCard>
 </main>
 </div>
 );
};

export default MerchantPawBucksWallet;
