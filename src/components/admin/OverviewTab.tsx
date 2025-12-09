import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Store, DollarSign, Award, TrendingUp, Activity } from 'lucide-react';

export function OverviewTab() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMerchants: 0,
    totalTransactions: 0,
    totalGMV: 0,
    totalCashback: 0,
    platformRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_analytics');
      
      if (error) throw error;
      
      if (data && data[0]) {
        const platformFee = data[0].total_gmv * 0.03; // 3% platform fee
        setStats({
          totalUsers: data[0].total_users,
          totalMerchants: data[0].total_merchants,
          totalTransactions: data[0].total_transactions,
          totalGMV: data[0].total_gmv,
          totalCashback: data[0].total_cashback_distributed,
          platformRevenue: platformFee,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

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
    </div>
  );
}
