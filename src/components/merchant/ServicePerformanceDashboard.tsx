import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GradientCard } from "@/components/ui/gradient-card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, Eye, MousePointer, Users, DollarSign, Star,
  ArrowUpRight, ArrowDownRight, Minus, BarChart3
} from "lucide-react";
import { format, subDays } from "date-fns";

type ServiceStat = {
  service_name: string;
  impressions: number;
  clicks: number;
  profile_views: number;
  transactions: number;
  transaction_revenue: number;
  reviews: number;
  bookings: number;
  amount_paid: number;
  payment_method: string;
  purchased_at: string;
  expires_at: string | null;
};

const CHART_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))',
  'hsl(var(--chart-7))', 'hsl(var(--chart-8))',
];

function ctr(clicks: number, impressions: number): string {
  if (impressions === 0) return '0%';
  return ((clicks / impressions) * 100).toFixed(1) + '%';
}

function roiMultiplier(revenue: number, cost: number): string {
  if (cost === 0) return '∞';
  return (revenue / cost).toFixed(1) + 'x';
}

function TrendIndicator({ value }: { value: number }) {
  if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
  if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function ServicePerformanceDashboard({ merchantId }: { merchantId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['service-performance', merchantId],
    queryFn: async () => {
      // Get active purchases with service details
      const { data: purchases, error: purchasesError } = await supabase
        .from('merchant_service_purchases')
        .select('*, merchant_market_services(name)')
        .eq('merchant_id', merchantId)
        .eq('status', 'active');

      if (purchasesError) throw purchasesError;
      if (!purchases || purchases.length === 0) return { services: [], dailyData: [] };

      const serviceNames = purchases.map((p: any) => p.merchant_market_services?.name).filter(Boolean);

      // Get aggregated daily performance for last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];
      const { data: dailyStats } = await supabase
        .from('service_performance_daily')
        .select('*')
        .eq('merchant_id', merchantId)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: true });

      // Get raw event counts for real-time (today's data not yet aggregated)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: todayEvents } = await supabase
        .from('service_conversion_events')
        .select('service_name, event_type')
        .eq('merchant_id', merchantId)
        .gte('created_at', todayStart.toISOString());

      // Build per-service summary
      const serviceStats: ServiceStat[] = purchases.map((p: any) => {
        const name = p.merchant_market_services?.name || 'Unknown';
        const daily = (dailyStats || []).filter((d: any) => d.service_name === name);
        const todayForService = (todayEvents || []).filter((e: any) => e.service_name === name);

        const totalImpressions = daily.reduce((s: number, d: any) => s + (d.impressions || 0), 0)
          + todayForService.filter((e: any) => e.event_type === 'impression').length;
        const totalClicks = daily.reduce((s: number, d: any) => s + (d.clicks || 0), 0)
          + todayForService.filter((e: any) => e.event_type === 'click').length;
        const totalProfileViews = daily.reduce((s: number, d: any) => s + (d.profile_views || 0), 0)
          + todayForService.filter((e: any) => e.event_type === 'profile_view').length;
        const totalTransactions = daily.reduce((s: number, d: any) => s + (d.transactions || 0), 0)
          + todayForService.filter((e: any) => e.event_type === 'transaction').length;
        const totalRevenue = daily.reduce((s: number, d: any) => s + parseFloat(d.transaction_revenue || '0'), 0);
        const totalReviews = daily.reduce((s: number, d: any) => s + (d.reviews || 0), 0);
        const totalBookings = daily.reduce((s: number, d: any) => s + (d.bookings || 0), 0);

        return {
          service_name: name,
          impressions: totalImpressions,
          clicks: totalClicks,
          profile_views: totalProfileViews,
          transactions: totalTransactions,
          transaction_revenue: totalRevenue,
          reviews: totalReviews,
          bookings: totalBookings,
          amount_paid: p.amount_paid || 0,
          payment_method: p.payment_method || 'usd',
          purchased_at: p.purchased_at || p.created_at,
          expires_at: p.expires_at,
        };
      });

      // Build daily chart data
      const dateMap: Record<string, Record<string, number>> = {};
      for (const d of dailyStats || []) {
        if (!dateMap[d.date]) dateMap[d.date] = {};
        dateMap[d.date][d.service_name] = (d.clicks || 0) + (d.profile_views || 0);
      }
      const dailyData = Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, services]) => ({
          date: format(new Date(date + 'T00:00:00'), 'MMM d'),
          ...services,
        }));

      return { services: serviceStats, dailyData };
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const services = data?.services || [];
  const dailyData = data?.dailyData || [];

  if (services.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No Active Services</h3>
          <p className="text-muted-foreground">Purchase services from the Merchant Market to see performance data here.</p>
        </CardContent>
      </Card>
    );
  }

  // Totals across all services
  const totalImpressions = services.reduce((s, sv) => s + sv.impressions, 0);
  const totalClicks = services.reduce((s, sv) => s + sv.clicks, 0);
  const totalRevenue = services.reduce((s, sv) => s + sv.transaction_revenue, 0);
  const totalSpend = services.reduce((s, sv) => s + (sv.payment_method === 'usd' ? sv.amount_paid : sv.amount_paid / 1000), 0);
  const totalTransactions = services.reduce((s, sv) => s + sv.transactions, 0);

  // Pie chart data
  const pieData = services
    .filter(s => s.clicks > 0 || s.impressions > 0)
    .map((s, i) => ({
      name: s.service_name.length > 20 ? s.service_name.slice(0, 18) + '…' : s.service_name,
      value: s.clicks + s.profile_views,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" />
          Service Performance & ROI
        </h2>
        <p className="text-muted-foreground">30-day overview of all active service outcomes</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <GradientCard>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Impressions</span>
          </div>
          <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
        </GradientCard>
        <GradientCard>
          <div className="flex items-center gap-2 mb-2">
            <MousePointer className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Clicks</span>
          </div>
          <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">CTR: {ctr(totalClicks, totalImpressions)}</p>
        </GradientCard>
        <GradientCard>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Conversions</span>
          </div>
          <p className="text-2xl font-bold">{totalTransactions}</p>
        </GradientCard>
        <GradientCard>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Revenue</span>
          </div>
          <p className="text-2xl font-bold">${totalRevenue.toFixed(0)}</p>
        </GradientCard>
        <GradientCard gradient>
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">ROI</span>
          </div>
          <p className="text-2xl font-bold">{roiMultiplier(totalRevenue, totalSpend)}</p>
          <p className="text-xs text-muted-foreground">Spend: ${totalSpend.toFixed(0)}</p>
        </GradientCard>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        <GradientCard>
          <h3 className="text-lg font-semibold mb-4">Daily Engagement</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                {services.map((s, i) => (
                  <Bar
                    key={s.service_name}
                    dataKey={s.service_name}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                    stackId="engagement"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              No engagement data yet — tracking starts when consumers interact
            </div>
          )}
        </GradientCard>

        <GradientCard>
          <h3 className="text-lg font-semibold mb-4">Engagement by Service</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              No data yet
            </div>
          )}
        </GradientCard>
      </div>

      {/* Per-service breakdown */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Per-Service Breakdown</h3>
        <div className="grid gap-4">
          {services.map((s, i) => {
            const cost = s.payment_method === 'usd' ? s.amount_paid : s.amount_paid / 1000;
            const roi = cost > 0 ? s.transaction_revenue / cost : 0;

            return (
              <Card key={s.service_name} className="overflow-hidden">
                <div className="flex items-stretch">
                  <div
                    className="w-1.5 flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{s.service_name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {s.payment_method === 'usd' ? `$${s.amount_paid}` : `${s.amount_paid.toLocaleString()} PB`}
                          {s.expires_at && ` · Expires ${format(new Date(s.expires_at), 'MMM d, yyyy')}`}
                        </p>
                      </div>
                      <Badge
                        variant={roi >= 1 ? 'default' : 'secondary'}
                        className={roi >= 2 ? 'bg-green-500 hover:bg-green-600' : roi >= 1 ? 'bg-primary' : ''}
                      >
                        <TrendIndicator value={roi - 1} />
                        <span className="ml-1">{roiMultiplier(s.transaction_revenue, cost)} ROI</span>
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold">{s.impressions.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Impressions</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{s.clicks.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Clicks</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{ctr(s.clicks, s.impressions)}</p>
                        <p className="text-xs text-muted-foreground">CTR</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{s.profile_views}</p>
                        <p className="text-xs text-muted-foreground">Profile Views</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{s.transactions}</p>
                        <p className="text-xs text-muted-foreground">Transactions</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">${s.transaction_revenue.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
