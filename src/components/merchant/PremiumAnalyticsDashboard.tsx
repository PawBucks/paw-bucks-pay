import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradientCard } from "@/components/ui/gradient-card";
import { Users, TrendingUp, Target, BarChart3, Activity, MapPin, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function PremiumAnalyticsDashboard() {
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ['premium-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('merchant-get-premium-analytics');
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !analyticsData?.has_access) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Premium Analytics Dashboard</h3>
          <p className="text-muted-foreground text-sm">
            {analyticsData?.message || 'Subscribe to access advanced analytics'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { analytics } = analyticsData;
  const { customer_demographics, transaction_velocity, competitive_benchmarking } = analytics;

  // Transform transaction by day data for chart
  const transactionChartData = Object.entries(transaction_velocity.by_day || {}).map(([date, count]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    transactions: count as number
  }));

  // Competitive benchmarking data for chart
  const benchmarkData = [
    { name: 'Avg Transaction', yours: competitive_benchmarking.your_avg_transaction, market: competitive_benchmarking.market_avg_transaction },
    { name: 'Customers', yours: competitive_benchmarking.your_customer_count, market: competitive_benchmarking.market_avg_customers },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Premium Analytics Dashboard</h2>
          <p className="text-muted-foreground">Advanced insights for your business</p>
        </div>
        <Badge className="bg-gradient-to-r from-primary to-primary/60">Premium</Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold">{customer_demographics.total_customers}</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Transaction</p>
              <p className="text-2xl font-bold">${customer_demographics.avg_transaction_value}</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Daily Velocity</p>
              <p className="text-2xl font-bold">{transaction_velocity.daily_avg} txns/day</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <MapPin className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unique Locations</p>
              <p className="text-2xl font-bold">{customer_demographics.unique_locations}</p>
            </div>
          </div>
        </GradientCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Velocity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Transaction Velocity (30 Days)
            </CardTitle>
            <CardDescription>
              {transaction_velocity.total_last_30_days} transactions in the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={transactionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="transactions" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No transaction data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competitive Benchmarking Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Competitive Benchmarking
            </CardTitle>
            <CardDescription>
              Your performance vs market average
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={benchmarkData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={100} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => value.toFixed(2)}
                />
                <Bar dataKey="yours" fill="hsl(var(--primary))" name="You" radius={[0, 4, 4, 0]} />
                <Bar dataKey="market" fill="hsl(var(--muted))" name="Market Avg" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Velocity Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
          <CardDescription>How you compare to the market</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Transaction Value</p>
              <p className="text-3xl font-bold text-primary">
                {((competitive_benchmarking.your_avg_transaction / competitive_benchmarking.market_avg_transaction) * 100 - 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {competitive_benchmarking.your_avg_transaction > competitive_benchmarking.market_avg_transaction ? 'above' : 'below'} market
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Customer Base</p>
              <p className="text-3xl font-bold text-primary">
                {((competitive_benchmarking.your_customer_count / competitive_benchmarking.market_avg_customers) * 100 - 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {competitive_benchmarking.your_customer_count > competitive_benchmarking.market_avg_customers ? 'above' : 'below'} market
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Transaction Velocity</p>
              <p className="text-3xl font-bold text-primary">
                {((competitive_benchmarking.your_velocity / competitive_benchmarking.market_avg_velocity) * 100 - 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {competitive_benchmarking.your_velocity > competitive_benchmarking.market_avg_velocity ? 'above' : 'below'} market
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
