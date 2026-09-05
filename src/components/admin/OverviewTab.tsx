import { useEffect, useState, useCallback } from'react';
import { supabase } from'@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from'@/components/ui/card';
import { Users, Store, DollarSign, Award, TrendingUp, Activity, RotateCcw, Gauge, Repeat, Shuffle, CreditCard, Briefcase, Megaphone, ShoppingBag } from "lucide-react";
import { Progress } from'@/components/ui/progress';
import { cn } from'@/lib/utils';

export function OverviewTab() {
 const [stats, setStats] = useState({
 totalUsers: 0,
 totalMerchants: 0,
 totalTransactions: 0,
 totalGMV: 0,
 totalCashback: 0,
 platformRevenue: 0,
 refundedTransactions: 0,
 refundedAmount: 0,
 totalPawbucksEarned: 0,
 totalPawbucksSpent: 0,
 pawbucksSpendRate: 0,
 repeatRedemptionRate: 0,
 repeatRedeemers: 0,
 totalRedeemers: 0,
 crossMerchantRate: 0,
  crossMerchantPb: 0,
  attributedPb: 0,
  pawpassSubscribers: 0,
  pawpassPlusSubscribers: 0,
  subscriptionMrr: 0,
  merchantServicesRevenue: 0,
  merchantServicesActive: 0,
   brandedCampaignRevenue: 0,
    brandedCampaignDelivered: 0,
    brandedCampaignCommitted: 0,
   marketplaceRevenue: 0,
   marketplaceOrders: 0,
  });
 const [loading, setLoading] = useState(true);
 const [errorMessage, setErrorMessage] = useState<string | null>(null);
 const [isSuperAdmin, setIsSuperAdmin] = useState(false);

 useEffect(() => {
  let cancelled = false;
  (async () => {
   try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'superadmin' });
    if (!cancelled) setIsSuperAdmin(!!data);
   } catch (err) {
    console.error('SuperAdmin check failed:', err);
   }
  })();
  return () => { cancelled = true; };
 }, []);

 const loadStats = useCallback(async () => {
 try {
  setErrorMessage(null);
 const { data, error } = await supabase.rpc('get_admin_analytics');
 
 if (error) throw error;
 
 if (data && data[0]) {
 // Platform revenue now comes directly from application_fee sum (only on Stripe portions)
 setStats({
 totalUsers: data[0].total_users,
 totalMerchants: data[0].total_merchants,
 totalTransactions: data[0].total_transactions,
 totalGMV: data[0].total_gmv,
 totalCashback: data[0].total_rewards || 0, // Using total_rewards from the function
 platformRevenue: data[0].platform_revenue || 0, // Accurate fee from application_fee column
 refundedTransactions: data[0].total_refunded_transactions || 0,
 refundedAmount: data[0].total_refunded_amount || 0,
 totalPawbucksEarned: data[0].total_pawbucks_earned || 0,
 totalPawbucksSpent: data[0].total_pawbucks_spent || 0,
 pawbucksSpendRate: data[0].pawbucks_spend_rate || 0,
 repeatRedemptionRate: data[0].repeat_redemption_rate || 0,
 repeatRedeemers: data[0].repeat_redeemers || 0,
 totalRedeemers: data[0].total_redeemers || 0,
 crossMerchantRate: Number(data[0].cross_merchant_redemption_rate || 0),
 crossMerchantPb: Number(data[0].cross_merchant_redeemed_pb || 0),
  attributedPb: Number(data[0].attributed_redeemed_pb || 0),
  pawpassSubscribers: Number(data[0].pawpass_subscribers || 0),
  pawpassPlusSubscribers: Number(data[0].pawpass_plus_subscribers || 0),
  subscriptionMrr: Number(data[0].subscription_mrr || 0),
  merchantServicesRevenue: Number(data[0].merchant_services_revenue || 0),
  merchantServicesActive: Number(data[0].merchant_services_active || 0),
   brandedCampaignRevenue: Number(data[0].branded_campaign_revenue || 0),
    brandedCampaignDelivered: Number(data[0].branded_campaign_delivered_usd || 0),
   brandedCampaignCommitted: Number((data[0] as { branded_campaign_committed_usd?: number }).branded_campaign_committed_usd || 0),
   marketplaceRevenue: Number(data[0].marketplace_revenue || 0),
   marketplaceOrders: Number(data[0].marketplace_orders || 0),
  });
 }
 } catch (error) {
 console.error('Error loading stats:', error);
  setErrorMessage(error instanceof Error ? error.message : 'Unable to load dashboard metrics.');
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 loadStats();
 }, [loadStats]);

 // Set up realtime subscription for transactions and wallet changes to auto-refresh stats
 useEffect(() => {
 const channel = supabase
 .channel('admin-overview-realtime')
 .on(
'postgres_changes',
 {
 event:'*',
 schema:'public',
 table:'transactions',
 },
 (payload) => {
 console.log('[Realtime] Admin: Transaction update detected:', payload);
 loadStats();
 }
 )
 .on(
'postgres_changes',
 {
 event:'*',
 schema:'public',
 table:'pawbucks_activity',
 },
 () => {
 loadStats();
 }
 )
  .on(
'postgres_changes',
  {
  event:'*',
  schema:'public',
  table:'merchant_pawbucks_activity',
  },
  () => {
  loadStats();
  }
  )
   .on(
'postgres_changes',
   { event:'*', schema:'public', table:'subscriptions' },
   () => { loadStats(); }
   )
   .on(
'postgres_changes',
   { event:'*', schema:'public', table:'pet_store_orders' },
   () => { loadStats(); }
   )
  .on(
'postgres_changes',
  { event:'*', schema:'public', table:'merchant_service_purchases' },
  () => { loadStats(); }
  )
  .on(
'postgres_changes',
  { event:'*', schema:'public', table:'brand_campaigns' },
  () => { loadStats(); }
  )
  .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [loadStats]);

 const statCards = [
 {
 title:'Total Users',
 value: stats.totalUsers.toLocaleString(),
 icon: Users,
 color:'text-info',
 },
 {
 title:'Total Merchants',
 value: stats.totalMerchants.toLocaleString(),
 icon: Store,
 color:'text-primary',
 },
 {
 title:'Total Transactions',
 value: stats.totalTransactions.toLocaleString(),
 icon: Activity,
 color:'text-success',
 },
 {
 title:'Total GMV',
 value: `$${stats.totalGMV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
 icon: TrendingUp,
 color:'text-warning',
 },
 {
  title:'Success Fee Revenue',
 value: `$${stats.platformRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
 icon: DollarSign,
 color:'text-success',
 },
 {
 title:'Total Rewards Distributed',
 // totalCashback is in PawBucks, convert to USD (1 PawBuck = $0.001)
 value: `$${(stats.totalCashback * 0.001).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
 icon: Award,
 color:'text-accent',
 },
 {
 title:'Refunds Processed',
 value: `${stats.refundedTransactions} ($${stats.refundedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
 icon: RotateCcw,
 color:'text-destructive',
 },
 ];

 if (loading) {
 return <div className="text-center py-8">Loading overview...</div>;
 }

 if (errorMessage) {
  return (
   <Card>
    <CardHeader>
     <CardTitle>Dashboard metrics unavailable</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
     <p className="text-sm text-muted-foreground">The Admin Dashboard could not load live platform totals.</p>
     <p className="text-sm text-destructive">{errorMessage}</p>
    </CardContent>
   </Card>
  );
 }

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-3xl font-bold">Platform Overview</h2>
 <p className="text-muted-foreground">Real-time statistics and key metrics</p>
 </div>

 {isSuperAdmin && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {statCards.map((stat) => {
  const Icon = stat.icon;
  return (
  <Card key={stat.title}>
  <CardHeader className="flex flex-row items-center justify-between pb-2">
  <CardTitle className="text-sm font-medium text-muted-foreground">
  {stat.title}
  </CardTitle>
  <Icon className={`w-5 h-5 ${stat.color}`} />
  </CardHeader>
  <CardContent>
  <div className="text-3xl font-bold">{stat.value}</div>
  </CardContent>
  </Card>
  );
   })}
   </div>
 )}

      {/* Revenue Streams (SuperAdmin only) */}
      {isSuperAdmin && (
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Revenue Streams
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Money actually processed: subscriptions, PawBucks Marketplace sales, merchant services, and Branded PawBucks campaigns
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-info" /> PawPass Subscription MRR
              </p>
              <p className="text-3xl font-bold">
                ${stats.subscriptionMrr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.pawpassSubscribers.toLocaleString()} PawPass ($10/mo) · {stats.pawpassPlusSubscribers.toLocaleString()} PawPass+ ($20/mo)
              </p>
              <p className="text-xs text-muted-foreground">
                Annualized ≈ ${(stats.subscriptionMrr * 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-primary" /> PawBucks Marketplace Sales
              </p>
              <p className="text-3xl font-bold">
                ${stats.marketplaceRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Card-processed marketplace sales (PawBucks-only orders excluded)</p>
              <p className="text-xs text-muted-foreground">
                {stats.marketplaceOrders.toLocaleString()} completed {stats.marketplaceOrders === 1 ? 'order' : 'orders'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-warning" /> Merchant Services Revenue
              </p>
              <p className="text-3xl font-bold">
                ${stats.merchantServicesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Card-processed premium service purchases</p>
              <p className="text-xs text-muted-foreground">
                {stats.merchantServicesActive.toLocaleString()} active service {stats.merchantServicesActive === 1 ? 'plan' : 'plans'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-accent" /> Branded PawBucks Revenue
              </p>
              <p className="text-3xl font-bold">
                ${stats.brandedCampaignRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Campaign funds actually collected</p>
              <p className="text-xs text-muted-foreground">
                Committed budgets ${stats.brandedCampaignCommitted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · delivered ≈ ${stats.brandedCampaignDelivered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Platform Revenue</p>
            <p className="text-3xl font-bold text-success">
              ${(stats.platformRevenue + stats.subscriptionMrr + stats.marketplaceRevenue + stats.merchantServicesRevenue + stats.brandedCampaignRevenue)
                .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">Success fees + subscriptions + marketplace sales + merchant services + branded campaigns</p>
          </div>
        </CardContent>
      </Card>

  {/* PawBucks Spend Rate Card */}
 <Card className="border-2">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <div>
 <CardTitle className="text-lg font-bold flex items-center gap-2">
 <Gauge className="w-5 h-5 text-primary" />
 PawBucks Spend Rate
 </CardTitle>
 <p className="text-sm text-muted-foreground mt-1">
 Ratio of PawBucks spent vs earned — healthy ecosystems target 70–90%
 </p>
 </div>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="flex items-end gap-3">
 <span className={cn(
"text-5xl font-extrabold tracking-tight",
 stats.pawbucksSpendRate >= 70 && stats.pawbucksSpendRate <= 90 ?"text-success" :
 stats.pawbucksSpendRate >= 50 ?"text-warning" :"text-destructive"
 )}>
 {stats.pawbucksSpendRate}%
 </span>
 <span className={cn(
"text-sm font-semibold mb-2 px-2 py-0.5 rounded-full",
 stats.pawbucksSpendRate >= 70 && stats.pawbucksSpendRate <= 90
 ?"bg-success/10 text-success"
 : stats.pawbucksSpendRate >= 50
 ?"bg-warning/10 text-warning"
 :"bg-destructive/10 text-destructive"
 )}>
 {stats.pawbucksSpendRate >= 70 && stats.pawbucksSpendRate <= 90 ?"Healthy" :
 stats.pawbucksSpendRate >= 50 ?"Moderate" :"Critical"}
 </span>
 </div>

 {/* Progress bar with zone markers */}
 <div className="space-y-2">
 <div className="relative">
 <Progress
 value={Math.min(stats.pawbucksSpendRate, 100)}
 className={cn(
"h-4 rounded-full",
 stats.pawbucksSpendRate >= 70 && stats.pawbucksSpendRate <= 90
 ?"[&>div]:bg-success"
 : stats.pawbucksSpendRate >= 50
 ?"[&>div]:bg-warning"
 :"[&>div]:bg-destructive"
 )}
 />
 </div>
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>0%</span>
 <span className="text-destructive font-medium">50%</span>
 <span className="text-success font-medium">70–90%</span>
 <span>100%</span>
 </div>
 </div>

 {/* Breakdown */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Earned</p>
 <p className="text-xl font-bold">
 {stats.totalPawbucksEarned.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">PB</span>
 </p>
 <p className="text-xs text-muted-foreground">
 ≈ ${(stats.totalPawbucksEarned * 0.001).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
 </p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Spent</p>
 <p className="text-xl font-bold">
 {stats.totalPawbucksSpent.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">PB</span>
 </p>
 <p className="text-xs text-muted-foreground">
 ≈ ${(stats.totalPawbucksSpent * 0.001).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
 </p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Unspent Balance</p>
 <p className="text-xl font-bold">
 {(stats.totalPawbucksEarned - stats.totalPawbucksSpent).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">PB</span>
 </p>
 <p className="text-xs text-muted-foreground">
 ≈ ${((stats.totalPawbucksEarned - stats.totalPawbucksSpent) * 0.001).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
 </p>
 </div>
 </div>

 {/* Warning message if below threshold */}
 {stats.pawbucksSpendRate < 50 && stats.totalPawbucksEarned > 0 && (
 <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
 <strong>Below 50%:</strong> Merchants may start viewing PawBucks as a loss rather than a benefit. Consider promotions or incentives to boost spending.
 </div>
 )}
 {stats.pawbucksSpendRate >= 50 && stats.pawbucksSpendRate < 70 && stats.totalPawbucksEarned > 0 && (
 <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 text-sm text-warning">
 <strong>Moderate:</strong> Spend rate is acceptable but below optimal. Target 70–90% for a healthy ecosystem.
 </div>
 )}
 </CardContent>
 </Card>
 {/* Merchant Repeat Redemption Rate Card */}
 <Card className="border-2">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <div>
 <CardTitle className="text-lg font-bold flex items-center gap-2">
 <Repeat className="w-5 h-5 text-primary" />
 Merchant Repeat Redemption Rate
 </CardTitle>
 <p className="text-sm text-muted-foreground mt-1">
 % of customers who redeem PawBucks and then return for another purchase
 </p>
 </div>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="flex items-end gap-3">
 <span className={cn(
"text-5xl font-extrabold tracking-tight",
 stats.repeatRedemptionRate >= 60 ?"text-success" :
 stats.repeatRedemptionRate >= 35 ?"text-warning" :"text-destructive"
 )}>
 {stats.repeatRedemptionRate}%
 </span>
 <span className={cn(
"text-sm font-semibold mb-2 px-2 py-0.5 rounded-full",
 stats.repeatRedemptionRate >= 60
 ?"bg-success/10 text-success"
 : stats.repeatRedemptionRate >= 35
 ?"bg-warning/10 text-warning"
 :"bg-destructive/10 text-destructive"
 )}>
 {stats.repeatRedemptionRate >= 60 ?"Strong" :
 stats.repeatRedemptionRate >= 35 ?"Moderate" :"Needs Attention"}
 </span>
 </div>

 <div className="space-y-2">
 <div className="relative">
 <Progress
 value={Math.min(stats.repeatRedemptionRate, 100)}
 className={cn(
"h-4 rounded-full",
 stats.repeatRedemptionRate >= 60
 ?"[&>div]:bg-success"
 : stats.repeatRedemptionRate >= 35
 ?"[&>div]:bg-warning"
 :"[&>div]:bg-destructive"
 )}
 />
 </div>
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>0%</span>
 <span className="text-destructive font-medium">35%</span>
 <span className="text-success font-medium">60%+</span>
 <span>100%</span>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Repeat Redeemers</p>
 <p className="text-xl font-bold">{stats.repeatRedeemers.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground">Came back after using PawBucks</p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Redeemers</p>
 <p className="text-xl font-bold">{stats.totalRedeemers.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground">All customers who spent PawBucks</p>
 </div>
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground uppercase tracking-wide">One-Time Only</p>
 <p className="text-xl font-bold">{(stats.totalRedeemers - stats.repeatRedeemers).toLocaleString()}</p>
 <p className="text-xs text-muted-foreground">Used PawBucks but didn't return</p>
 </div>
 </div>

 {stats.repeatRedemptionRate < 35 && stats.totalRedeemers > 0 && (
 <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
 <strong>Below 35%:</strong> PawBucks may only be driving discounted first visits. Consider merchant incentives and follow-up promotions to boost return rates.
 </div>
 )}
 {stats.repeatRedemptionRate >= 35 && stats.repeatRedemptionRate < 60 && stats.totalRedeemers > 0 && (
 <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 text-sm text-warning">
 <strong>Moderate:</strong> Some redeemers are returning, but there's room to grow. Target 60%+ for strong merchant confidence in PawBucks.
 </div>
 )}
 {stats.repeatRedemptionRate >= 60 && stats.totalRedeemers > 0 && (
 <div className="bg-success/5 border border-success/20 rounded-lg p-3 text-sm text-success">
 <strong>Strong:</strong> PawBucks is successfully driving repeat business. Merchants should see clear value in accepting PawBucks.
 </div>
 )}
 </CardContent>
 </Card>
    {/* Cross-Merchant Redemption Rate Card */}
    <Card className="border-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-primary" />
            Cross-Merchant Redemption Rate
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            % of PawBucks redeemed at a different merchant than where they were earned
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end gap-3">
          <span className={cn(
            "text-5xl font-extrabold tracking-tight",
            stats.crossMerchantRate >= 40 ? "text-success" :
            stats.crossMerchantRate >= 20 ? "text-warning" : "text-destructive"
          )}>
            {stats.crossMerchantRate}%
          </span>
          <span className={cn(
            "text-sm font-semibold mb-2 px-2 py-0.5 rounded-full",
            stats.crossMerchantRate >= 40
              ? "bg-success/10 text-success"
              : stats.crossMerchantRate >= 20
              ? "bg-warning/10 text-warning"
              : "bg-destructive/10 text-destructive"
          )}>
            {stats.crossMerchantRate >= 40 ? "Strong Circulation" :
             stats.crossMerchantRate >= 20 ? "Moderate" : "Siloed"}
          </span>
        </div>

        <div className="space-y-2">
          <Progress
            value={Math.min(stats.crossMerchantRate, 100)}
            className={cn(
              "h-4 rounded-full",
              stats.crossMerchantRate >= 40
                ? "[&>div]:bg-success"
                : stats.crossMerchantRate >= 20
                ? "[&>div]:bg-warning"
                : "[&>div]:bg-destructive"
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span className="text-destructive font-medium">20%</span>
            <span className="text-success font-medium">40%+</span>
            <span>100%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Redeemed Cross-Merchant</p>
            <p className="text-xl font-bold">
              {stats.crossMerchantPb.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">PB</span>
            </p>
            <p className="text-xs text-muted-foreground">
              ≈ ${(stats.crossMerchantPb * 0.001).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Redeemed Same-Merchant</p>
            <p className="text-xl font-bold">
              {(stats.attributedPb - stats.crossMerchantPb).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">PB</span>
            </p>
            <p className="text-xs text-muted-foreground">Earned & spent at same merchant</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Attributable Total</p>
            <p className="text-xl font-bold">
              {stats.attributedPb.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">PB</span>
            </p>
            <p className="text-xs text-muted-foreground">Traceable to earning merchant</p>
          </div>
        </div>

        {stats.crossMerchantRate < 20 && stats.attributedPb > 0 && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
            <strong>Below 20%:</strong> PawBucks are staying siloed at their earning merchant. Encourage cross-merchant discovery to grow ecosystem stickiness.
          </div>
        )}
        {stats.crossMerchantRate >= 20 && stats.crossMerchantRate < 40 && stats.attributedPb > 0 && (
          <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 text-sm text-warning">
            <strong>Moderate:</strong> Some PawBucks are circulating across merchants. Target 40%+ for a healthy network effect.
          </div>
        )}
        {stats.crossMerchantRate >= 40 && stats.attributedPb > 0 && (
          <div className="bg-success/5 border border-success/20 rounded-lg p-3 text-sm text-success">
            <strong>Strong:</strong> PawBucks are flowing across the merchant network, driving cross-shop traffic.
          </div>
        )}
      </CardContent>
    </Card>
 </div>
 );
}
