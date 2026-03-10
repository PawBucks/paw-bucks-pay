import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Store, DollarSign, Award, TrendingUp, Activity, RotateCcw, Gauge, Repeat } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

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
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
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
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
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
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('[Realtime] Admin: Transaction update detected:', payload);
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pawbucks_activity',
        },
        () => {
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_pawbucks_activity',
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadStats]);

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Total Merchants',
      value: stats.totalMerchants.toLocaleString(),
      icon: Store,
      color: 'text-purple-500',
    },
    {
      title: 'Total Transactions',
      value: stats.totalTransactions.toLocaleString(),
      icon: Activity,
      color: 'text-green-500',
    },
    {
      title: 'Total GMV',
      value: `$${stats.totalGMV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-orange-500',
    },
    {
      title: 'Platform Revenue (3%)',
      value: `$${stats.platformRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-emerald-500',
    },
    {
      title: 'Total Rewards Distributed',
      // totalCashback is in PawBucks, convert to USD (1 PawBuck = $0.001)
      value: `$${(stats.totalCashback * 0.001).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Award,
      color: 'text-pink-500',
    },
    {
      title: 'Refunds Processed',
      value: `${stats.refundedTransactions} ($${stats.refundedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
      icon: RotateCcw,
      color: 'text-red-500',
    },
  ];

  if (loading) {
    return <div className="text-center py-8">Loading overview...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Platform Overview</h2>
        <p className="text-muted-foreground">Real-time statistics and key metrics</p>
      </div>

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
              stats.pawbucksSpendRate >= 70 && stats.pawbucksSpendRate <= 90 ? "text-emerald-500" :
              stats.pawbucksSpendRate >= 50 ? "text-amber-500" : "text-destructive"
            )}>
              {stats.pawbucksSpendRate}%
            </span>
            <span className={cn(
              "text-sm font-semibold mb-2 px-2 py-0.5 rounded-full",
              stats.pawbucksSpendRate >= 70 && stats.pawbucksSpendRate <= 90
                ? "bg-emerald-500/10 text-emerald-600"
                : stats.pawbucksSpendRate >= 50
                ? "bg-amber-500/10 text-amber-600"
                : "bg-destructive/10 text-destructive"
            )}>
              {stats.pawbucksSpendRate >= 70 && stats.pawbucksSpendRate <= 90 ? "Healthy" :
               stats.pawbucksSpendRate >= 50 ? "Moderate" : "Critical"}
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
                    ? "[&>div]:bg-emerald-500"
                    : stats.pawbucksSpendRate >= 50
                    ? "[&>div]:bg-amber-500"
                    : "[&>div]:bg-destructive"
                )}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="text-destructive font-medium">50% ⚠️</span>
              <span className="text-emerald-600 font-medium">70–90% ✓</span>
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
              <strong>⚠️ Below 50%:</strong> Merchants may start viewing PawBucks as a loss rather than a benefit. Consider promotions or incentives to boost spending.
            </div>
          )}
          {stats.pawbucksSpendRate >= 50 && stats.pawbucksSpendRate < 70 && stats.totalPawbucksEarned > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-700">
              <strong>📊 Moderate:</strong> Spend rate is acceptable but below optimal. Target 70–90% for a healthy ecosystem.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
