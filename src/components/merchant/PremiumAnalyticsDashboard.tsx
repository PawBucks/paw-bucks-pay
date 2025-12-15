import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradientCard } from "@/components/ui/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, TrendingUp, Target, BarChart3, Activity, DollarSign, 
  ArrowUpRight, ArrowDownRight, Clock, Calendar, AlertCircle,
  Crown, UserCheck, Repeat, Loader2, Lightbulb, Star
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend 
} from "recharts";
import { useMemo } from "react";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  padding: '8px 12px'
};

export function PremiumAnalyticsDashboard() {
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ['premium-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('merchant-get-premium-analytics');
      if (error) throw error;
      return data;
    }
  });

  const formattedData = useMemo(() => {
    if (!analyticsData?.analytics) return null;
    const { analytics } = analyticsData;
    return analytics;
  }, [analyticsData]);

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
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {analyticsData?.message || 'This premium feature must be assigned by an admin. Contact support for access to advanced analytics.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!formattedData) return null;

  const { overview, period_comparison, revenue_trends, customer_insights, transaction_patterns, growth_opportunities, competitive_benchmarking } = formattedData;

  // Customer segments pie chart data
  const segmentsData = [
    { name: 'One-time', value: customer_insights.segments.one_time_buyers, color: COLORS[0] },
    { name: 'Repeat', value: customer_insights.segments.repeat_buyers, color: COLORS[1] },
    { name: 'Loyal (5+)', value: customer_insights.segments.loyal_customers, color: COLORS[2] },
    { name: 'VIP ($500+)', value: customer_insights.segments.vip_customers, color: COLORS[3] },
  ].filter(s => s.value > 0);

  const getGrowthIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    return null;
  };

  const getGrowthColor = (value: number) => {
    if (value > 0) return 'text-green-500';
    if (value < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High Priority</Badge>;
      case 'positive':
        return <Badge className="bg-green-500">Positive</Badge>;
      default:
        return <Badge variant="secondary">Medium</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Premium Analytics Dashboard</h2>
          <p className="text-muted-foreground">Advanced business intelligence and growth insights</p>
        </div>
        <Badge className="bg-gradient-to-r from-primary to-primary/60 gap-1">
          <Crown className="h-3 w-3" /> Premium
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">${overview.total_revenue.toLocaleString()}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <p className="text-2xl font-bold">{overview.unique_customers}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Activity className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-bold">{overview.total_transactions}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-500/10">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Order Value</p>
                  <p className="text-2xl font-bold">${overview.avg_transaction_value}</p>
                </div>
              </div>
            </GradientCard>
          </div>

          {/* Period Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                30-Day Performance
              </CardTitle>
              <CardDescription>Comparison with previous 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Revenue</p>
                  <p className="text-3xl font-bold">${period_comparison.current_period.revenue.toLocaleString()}</p>
                  <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(period_comparison.growth.revenue)}`}>
                    {getGrowthIcon(period_comparison.growth.revenue)}
                    <span className="text-sm font-medium">{period_comparison.growth.revenue.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Transactions</p>
                  <p className="text-3xl font-bold">{period_comparison.current_period.transactions}</p>
                  <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(period_comparison.growth.transactions)}`}>
                    {getGrowthIcon(period_comparison.growth.transactions)}
                    <span className="text-sm font-medium">{period_comparison.growth.transactions.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Customers</p>
                  <p className="text-3xl font-bold">{period_comparison.current_period.customers}</p>
                  <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(period_comparison.growth.customers)}`}>
                    {getGrowthIcon(period_comparison.growth.customers)}
                    <span className="text-sm font-medium">{period_comparison.growth.customers.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenue_trends.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary)/0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REVENUE TAB */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Revenue */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue (12 Months)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenue_trends.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Transactions by Month */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenue_trends.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={tooltipStyle}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="transactions" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Competitive Benchmarking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Industry Benchmarking
              </CardTitle>
              <CardDescription>How you compare to pet service industry averages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Avg Order Value</p>
                  <p className="text-2xl font-bold">${competitive_benchmarking.your_avg_transaction.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Industry: ${competitive_benchmarking.industry_avg_transaction}</p>
                  <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(competitive_benchmarking.transaction_value_vs_industry)}`}>
                    {getGrowthIcon(competitive_benchmarking.transaction_value_vs_industry)}
                    <span className="text-sm font-medium">{competitive_benchmarking.transaction_value_vs_industry.toFixed(1)}% vs industry</span>
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Repeat Purchase Rate</p>
                  <p className="text-2xl font-bold">{competitive_benchmarking.your_repeat_rate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Industry: {competitive_benchmarking.industry_avg_repeat_rate}%</p>
                  <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(competitive_benchmarking.repeat_rate_vs_industry)}`}>
                    {getGrowthIcon(competitive_benchmarking.repeat_rate_vs_industry)}
                    <span className="text-sm font-medium">{competitive_benchmarking.repeat_rate_vs_industry > 0 ? '+' : ''}{competitive_benchmarking.repeat_rate_vs_industry.toFixed(1)}pp</span>
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Customer Lifetime Value</p>
                  <p className="text-2xl font-bold">${competitive_benchmarking.your_ltv.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Industry: ${competitive_benchmarking.industry_avg_ltv}</p>
                  <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(competitive_benchmarking.ltv_vs_industry)}`}>
                    {getGrowthIcon(competitive_benchmarking.ltv_vs_industry)}
                    <span className="text-sm font-medium">{competitive_benchmarking.ltv_vs_industry.toFixed(1)}% vs industry</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CUSTOMERS TAB */}
        <TabsContent value="customers" className="space-y-6">
          {/* Customer Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Lifetime Value</p>
                  <p className="text-2xl font-bold">${customer_insights.metrics.avg_lifetime_value}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <Repeat className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Repeat Purchase Rate</p>
                  <p className="text-2xl font-bold">{customer_insights.metrics.repeat_purchase_rate}%</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Activity className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Purchases/Customer</p>
                  <p className="text-2xl font-bold">{customer_insights.metrics.avg_purchases_per_customer}</p>
                </div>
              </div>
            </GradientCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Segments */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Segments</CardTitle>
                <CardDescription>Distribution of customer types</CardDescription>
              </CardHeader>
              <CardContent>
                {segmentsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={segmentsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {segmentsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No customer data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Top Customers
                </CardTitle>
                <CardDescription>Your highest-value customers</CardDescription>
              </CardHeader>
              <CardContent>
                {customer_insights.top_customers.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {customer_insights.top_customers.slice(0, 5).map((customer: any, index: number) => (
                      <div key={customer.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-medium">Customer #{customer.user_id.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">
                              {customer.purchase_count} purchases · ${customer.avg_order_value.toFixed(2)} avg
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">${customer.total_spent.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {customer.days_since_last_purchase} days ago
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No customer data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PATTERNS TAB */}
        <TabsContent value="patterns" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Peak Day</p>
                  <p className="text-2xl font-bold">{transaction_patterns.peak_day}</p>
                </div>
              </div>
            </GradientCard>

            <GradientCard gradient>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <Clock className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Peak Hour</p>
                  <p className="text-2xl font-bold">{transaction_patterns.peak_hour}</p>
                </div>
              </div>
            </GradientCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Day of Week */}
            <Card>
              <CardHeader>
                <CardTitle>Transactions by Day of Week</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={transaction_patterns.by_day_of_week}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="transactions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By Hour */}
            <Card>
              <CardHeader>
                <CardTitle>Transactions by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={transaction_patterns.by_hour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area 
                      type="monotone" 
                      dataKey="transactions" 
                      stroke="hsl(var(--chart-2))" 
                      fill="hsl(var(--chart-2)/0.2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by Day */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={transaction_patterns.by_day_of_week}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INSIGHTS TAB */}
        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Growth Opportunities
              </CardTitle>
              <CardDescription>AI-powered recommendations based on your data</CardDescription>
            </CardHeader>
            <CardContent>
              {growth_opportunities.length > 0 ? (
                <div className="space-y-4">
                  {growth_opportunities.map((opportunity: any, index: number) => (
                    <div key={index} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{opportunity.title}</h4>
                            {getImpactBadge(opportunity.impact)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{opportunity.description}</p>
                          <div className="flex items-center gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            <span className="text-primary font-medium">{opportunity.action}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Great job! No critical issues detected.</p>
                  <p className="text-sm">Keep up the good work and check back for new insights.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Business Health Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Rewards Given</p>
                  <p className="text-xl font-bold">{overview.total_rewards_given.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">PawBucks</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">One-time Buyers</p>
                  <p className="text-xl font-bold">{customer_insights.segments.one_time_buyers}</p>
                  <p className="text-xs text-muted-foreground">customers</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Repeat Buyers</p>
                  <p className="text-xl font-bold">{customer_insights.segments.repeat_buyers}</p>
                  <p className="text-xs text-muted-foreground">customers</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">VIP Customers</p>
                  <p className="text-xl font-bold">{customer_insights.segments.vip_customers}</p>
                  <p className="text-xs text-muted-foreground">$500+ spent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
