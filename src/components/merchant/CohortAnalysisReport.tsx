import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradientCard } from "@/components/ui/gradient-card";
import { Users, TrendingUp, DollarSign, RefreshCw, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

interface CohortReportProps {
  reportData?: {
    cohorts: Array<{
      cohort_month: string;
      customer_count: number;
      avg_ltv: number;
      avg_aov: number;
      retention_rate: number;
    }>;
    summary: {
      total_customers: number;
      avg_lifetime_value: number;
      avg_order_value: number;
      avg_retention_rate: number;
    };
  };
}

export function CohortAnalysisReport({ reportData }: CohortReportProps) {
  const { data: purchases, isLoading } = useQuery({
    queryKey: ['cohort-report-purchase'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!merchant) throw new Error('Merchant not found');

      const { data, error } = await supabase
        .from('merchant_analytics_purchases')
        .select('*, merchant_analytics_products(*)')
        .eq('merchant_id', merchant.id)
        .not('report_data', 'is', null)
        .order('purchase_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !reportData
  });

  // Use provided reportData or find from purchases
  const cohortPurchase = purchases?.find(p => 
    p.merchant_analytics_products?.name?.includes('Cohort')
  );
  
  const data = reportData || (cohortPurchase?.report_data as CohortReportProps['reportData']);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Customer Cohort Analysis</h3>
          <p className="text-muted-foreground text-sm">
            Purchase this report to see detailed customer cohort analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  const { cohorts, summary } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Customer Cohort Analysis</h2>
          <p className="text-muted-foreground">Detailed customer retention and value metrics</p>
        </div>
        <Badge className="bg-gradient-to-r from-blue-500 to-blue-600">Report</Badge>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold">{summary.total_customers}</p>
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
              <p className="text-2xl font-bold">${summary.avg_lifetime_value.toFixed(2)}</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Order Value</p>
              <p className="text-2xl font-bold">${summary.avg_order_value.toFixed(2)}</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <RefreshCw className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Retention</p>
              <p className="text-2xl font-bold">{summary.avg_retention_rate.toFixed(1)}%</p>
            </div>
          </div>
        </GradientCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LTV by Cohort */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Lifetime Value by Cohort
            </CardTitle>
            <CardDescription>
              Average customer lifetime value per monthly cohort
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cohorts && cohorts.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={cohorts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="cohort_month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v}`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'LTV']}
                  />
                  <Bar dataKey="avg_ltv" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No cohort data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Retention Rate by Cohort */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Retention Rate by Cohort
            </CardTitle>
            <CardDescription>
              Customer retention percentage per cohort
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cohorts && cohorts.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={cohorts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="cohort_month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Retention']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="retention_rate" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No retention data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cohort Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cohort Details</CardTitle>
          <CardDescription>Breakdown by acquisition month</CardDescription>
        </CardHeader>
        <CardContent>
          {cohorts && cohorts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cohort</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Customers</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Avg LTV</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Avg AOV</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Retention</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{cohort.cohort_month}</td>
                      <td className="py-3 px-4 text-right">{cohort.customer_count}</td>
                      <td className="py-3 px-4 text-right">${cohort.avg_ltv.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">${cohort.avg_aov.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant={cohort.retention_rate > 50 ? 'default' : 'secondary'}>
                          {cohort.retention_rate.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No cohort data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
