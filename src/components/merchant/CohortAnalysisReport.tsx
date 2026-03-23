import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradientCard } from "@/components/ui/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Users, TrendingUp, DollarSign, Activity, Repeat, 
  Calendar, Loader2, UserCheck, Crown, Target,
  ArrowUpRight, ArrowDownRight, Download, RefreshCw
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line
} from "recharts";
import { useState } from "react";
import { toast } from "sonner";

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  padding: '8px 12px'
};

interface CohortData {
  cohort_month: string;
  customer_count: number;
  avg_ltv: number;
  avg_aov: number;
  retention_rate: number;
  total_revenue: number;
  avg_transactions_per_customer: number;
}

interface CustomerSegment {
  segment: string;
  count: number;
  total_value: number;
  avg_value: number;
  percentage: number;
}

interface CohortReport {
  generated_at: string;
  summary: {
    total_customers: number;
    avg_lifetime_value: number;
    avg_order_value: number;
    overall_retention_rate: number;
    total_cohorts: number;
    total_revenue: number;
    avg_transactions_per_customer: number;
  };
  cohort_breakdown: CohortData[];
  customer_segments: CustomerSegment[];
  retention_matrix: {
    cohort: string;
    months: number[];
  }[];
  recommendations: string[];
}

export function CohortAnalysisReport() {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['cohort-analysis-report'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('merchant-generate-cohort-report');
      if (error) throw error;
      return data as { has_access: boolean; report?: CohortReport; message?: string };
    }
  });

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await refetch();
      toast.success('Report regenerated with latest data');
    } catch {
      toast.error('Failed to regenerate report');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleExport = () => {
    if (!reportData?.report) return;
    
    const report = reportData.report;
    const csvContent = [
      ['Cohort Analysis Report'],
      ['Generated:', report.generated_at],
      [],
      ['Summary'],
      ['Total Customers', report.summary.total_customers],
      ['Average Lifetime Value', `$${report.summary.avg_lifetime_value}`],
      ['Average Order Value', `$${report.summary.avg_order_value}`],
      ['Overall Retention Rate', `${report.summary.overall_retention_rate}%`],
      [],
      ['Cohort Breakdown'],
      ['Cohort Month', 'Customers', 'Avg LTV', 'Avg AOV', 'Retention Rate', 'Total Revenue'],
      ...report.cohort_breakdown.map(c => [
        c.cohort_month,
        c.customer_count,
        `$${c.avg_ltv}`,
        `$${c.avg_aov}`,
        `${c.retention_rate}%`,
        `$${c.total_revenue}`
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohort-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reportData?.has_access) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Customer Cohort Analysis</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {reportData?.message || 'This premium feature must be assigned by an admin. Contact support for access to detailed customer cohort analysis.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const report = reportData.report;
  if (!report) return null;

  const { summary, cohort_breakdown, customer_segments, retention_matrix, recommendations } = report;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Customer Cohort Analysis</h2>
          <p className="text-muted-foreground">
            Deep insights into customer retention, lifetime value, and purchasing patterns
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Last updated: {new Date(report.generated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Badge className="bg-gradient-to-r from-primary to-primary/60 gap-1">
            <Crown className="h-3 w-3" /> Premium
          </Badge>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold">{summary.total_customers.toLocaleString()}</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/10">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Lifetime Value</p>
              <p className="text-2xl font-bold">${summary.avg_lifetime_value.toLocaleString()}</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Order Value</p>
              <p className="text-2xl font-bold">${summary.avg_order_value.toLocaleString()}</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Repeat className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overall Retention</p>
              <p className="text-2xl font-bold">{summary.overall_retention_rate}%</p>
            </div>
          </div>
        </GradientCard>
      </div>

      <Tabs defaultValue="cohorts" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* COHORTS TAB */}
        <TabsContent value="cohorts" className="space-y-6">
          {/* LTV by Cohort Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Lifetime Value by Cohort
              </CardTitle>
              <CardDescription>Average customer lifetime value grouped by acquisition month</CardDescription>
            </CardHeader>
            <CardContent>
              {cohort_breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={cohort_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="cohort_month" 
                      tick={{ fontSize: 12 }} 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Avg LTV']}
                    />
                    <Bar dataKey="avg_ltv" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="avg_ltv" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No cohort data available yet. Make some sales to see cohort analysis.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Retention Rate by Cohort */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5" />
                Retention Rate by Cohort
              </CardTitle>
              <CardDescription>Customer retention percentage for each acquisition cohort</CardDescription>
            </CardHeader>
            <CardContent>
              {cohort_breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={cohort_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="cohort_month" 
                      tick={{ fontSize: 12 }} 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      stroke="hsl(var(--muted-foreground))"
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Retention Rate']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="retention_rate" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No retention data available yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cohort Details Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Cohort Details
              </CardTitle>
              <CardDescription>Detailed metrics for each customer acquisition cohort</CardDescription>
            </CardHeader>
            <CardContent>
              {cohort_breakdown.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Cohort</th>
                        <th className="text-right py-3 px-2 font-medium">Customers</th>
                        <th className="text-right py-3 px-2 font-medium">Avg LTV</th>
                        <th className="text-right py-3 px-2 font-medium">Avg AOV</th>
                        <th className="text-right py-3 px-2 font-medium">Retention</th>
                        <th className="text-right py-3 px-2 font-medium">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohort_breakdown.map((cohort) => (
                        <tr key={cohort.cohort_month} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{cohort.cohort_month}</td>
                          <td className="py-3 px-2 text-right">{cohort.customer_count}</td>
                          <td className="py-3 px-2 text-right">${cohort.avg_ltv.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right">${cohort.avg_aov.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right">
                            <span className={cohort.retention_rate >= 50 ? 'text-green-500' : cohort.retention_rate >= 25 ? 'text-yellow-500' : 'text-red-500'}>
                              {cohort.retention_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">${cohort.total_revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No cohort data available yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RETENTION TAB */}
        <TabsContent value="retention" className="space-y-6">
          {/* Retention Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Cohort Retention Matrix
              </CardTitle>
              <CardDescription>Month-over-month customer retention by acquisition cohort</CardDescription>
            </CardHeader>
            <CardContent>
              {retention_matrix && retention_matrix.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Cohort</th>
                        {retention_matrix[0]?.months.map((_, i) => (
                          <th key={i} className="text-center py-3 px-2 font-medium">
                            Month {i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {retention_matrix.map((row) => (
                        <tr key={row.cohort} className="border-b">
                          <td className="py-3 px-2 font-medium">{row.cohort}</td>
                          {row.months.map((pct, i) => (
                            <td key={i} className="py-3 px-2 text-center">
                              <span 
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  pct >= 70 ? 'bg-green-500/20 text-green-500' :
                                  pct >= 40 ? 'bg-yellow-500/20 text-yellow-500' :
                                  pct > 0 ? 'bg-red-500/20 text-red-500' :
                                  'bg-muted text-muted-foreground'
                                }`}
                              >
                                {pct > 0 ? `${pct}%` : '-'}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Need more transaction history to generate retention matrix.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Retention Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">60-Day Retention</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {summary.overall_retention_rate}%
                </p>
                <p className="text-sm text-muted-foreground">
                  of customers return within 60 days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Avg Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {summary.avg_transactions_per_customer.toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">
                  transactions per customer
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  ${summary.total_revenue.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  from all cohorts combined
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SEGMENTS TAB */}
        <TabsContent value="segments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Customer Value Segments
              </CardTitle>
              <CardDescription>Breakdown of your customer base by value tier</CardDescription>
            </CardHeader>
            <CardContent>
              {customer_segments && customer_segments.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={customer_segments} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis 
                        type="category" 
                        dataKey="segment" 
                        tick={{ fontSize: 12 }} 
                        stroke="hsl(var(--muted-foreground))"
                        width={120}
                      />
                      <Tooltip 
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [value, 'Customers']}
                      />
                      <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} name="count" />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="space-y-4">
                    {customer_segments.map((segment) => (
                      <div key={segment.segment} className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{segment.segment}</span>
                          <Badge variant="secondary">{segment.percentage.toFixed(1)}%</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Customers</p>
                            <p className="font-semibold">{segment.count}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Value</p>
                            <p className="font-semibold">${segment.total_value.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Avg Value</p>
                            <p className="font-semibold">${segment.avg_value.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No segment data available yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INSIGHTS TAB */}
        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Strategic Recommendations
              </CardTitle>
              <CardDescription>AI-generated insights based on your cohort data</CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations && recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec, i) => (
                    <div 
                      key={i} 
                      className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border-l-4 border-primary"
                    >
                      <div className="p-2 rounded-full bg-primary/10">
                        <TrendingUp className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Collect more transaction data to unlock personalized recommendations.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key Takeaways */}
          <Card>
            <CardHeader>
              <CardTitle>Key Takeaways</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <h4 className="font-medium text-green-500 mb-2">Strengths</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {summary.overall_retention_rate >= 30 && (
                      <li>• Good customer retention rate ({summary.overall_retention_rate}%)</li>
                    )}
                    {summary.avg_lifetime_value > 100 && (
                      <li>• Strong customer lifetime value (${summary.avg_lifetime_value})</li>
                    )}
                    {summary.avg_transactions_per_customer >= 2 && (
                      <li>• Healthy repeat purchase rate</li>
                    )}
                    {summary.total_customers > 0 && (
                      <li>• Growing customer base ({summary.total_customers} customers)</li>
                    )}
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <h4 className="font-medium text-yellow-500 mb-2">Opportunities</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {summary.overall_retention_rate < 30 && (
                      <li>• Improve retention with loyalty programs</li>
                    )}
                    {summary.avg_lifetime_value < 100 && (
                      <li>• Increase LTV through upselling</li>
                    )}
                    {summary.avg_transactions_per_customer < 2 && (
                      <li>• Encourage repeat purchases with incentives</li>
                    )}
                    <li>• Target high-value segments for premium offers</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
