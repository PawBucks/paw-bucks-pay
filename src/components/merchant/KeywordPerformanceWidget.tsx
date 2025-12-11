import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradientCard } from "@/components/ui/gradient-card";
import { Search, Eye, MousePointerClick, TrendingUp, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function KeywordPerformanceWidget() {
  const { data: searchAnalytics, isLoading } = useQuery({
    queryKey: ['keyword-performance'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!merchant) throw new Error('Merchant not found');

      // Check if merchant has the keyword insights product
      const { data: subscription } = await supabase
        .from('merchant_analytics_subscriptions')
        .select('*, merchant_analytics_products(*)')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString());

      const hasKeywordAccess = subscription?.some(s => 
        s.merchant_analytics_products?.name?.includes('Keyword')
      );

      // Also check one-time purchases
      const { data: purchases } = await supabase
        .from('merchant_analytics_purchases')
        .select('*, merchant_analytics_products(*)')
        .eq('merchant_id', merchant.id);

      const hasPurchasedKeywords = purchases?.some(p => 
        p.merchant_analytics_products?.name?.includes('Keyword')
      );

      if (!hasKeywordAccess && !hasPurchasedKeywords) {
        return { has_access: false };
      }

      // Fetch search analytics data
      const { data, error } = await supabase
        .from('merchant_search_analytics')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('date', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Aggregate by search term
      const termStats: Record<string, { views: number; clicks: number; conversions: number }> = {};
      data?.forEach(row => {
        if (!termStats[row.search_term]) {
          termStats[row.search_term] = { views: 0, clicks: 0, conversions: 0 };
        }
        termStats[row.search_term].views += row.views || 0;
        termStats[row.search_term].clicks += row.clicks || 0;
        termStats[row.search_term].conversions += row.conversions || 0;
      });

      const keywords = Object.entries(termStats).map(([term, stats]) => ({
        term,
        views: stats.views,
        clicks: stats.clicks,
        conversions: stats.conversions,
        ctr: stats.views > 0 ? ((stats.clicks / stats.views) * 100) : 0,
        convRate: stats.clicks > 0 ? ((stats.conversions / stats.clicks) * 100) : 0
      })).sort((a, b) => b.views - a.views);

      return {
        has_access: true,
        keywords,
        totals: {
          totalViews: keywords.reduce((sum, k) => sum + k.views, 0),
          totalClicks: keywords.reduce((sum, k) => sum + k.clicks, 0),
          totalConversions: keywords.reduce((sum, k) => sum + k.conversions, 0)
        }
      };
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!searchAnalytics?.has_access) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Keyword Performance Insights</h3>
          <p className="text-muted-foreground text-sm">
            Purchase this report to see which search terms drive traffic to your business
          </p>
        </CardContent>
      </Card>
    );
  }

  const { keywords, totals } = searchAnalytics;
  const avgCTR = totals.totalViews > 0 ? ((totals.totalClicks / totals.totalViews) * 100) : 0;
  const avgConvRate = totals.totalClicks > 0 ? ((totals.totalConversions / totals.totalClicks) * 100) : 0;

  const topKeywords = keywords?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Keyword Performance Insights</h2>
          <p className="text-muted-foreground">See which search terms drive traffic</p>
        </div>
        <Badge className="bg-gradient-to-r from-orange-500 to-orange-600">Quarterly</Badge>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Views</p>
              <p className="text-2xl font-bold">{totals.totalViews.toLocaleString()}</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <MousePointerClick className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Clicks</p>
              <p className="text-2xl font-bold">{totals.totalClicks.toLocaleString()}</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg CTR</p>
              <p className="text-2xl font-bold">{avgCTR.toFixed(1)}%</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Search className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conversions</p>
              <p className="text-2xl font-bold">{totals.totalConversions}</p>
            </div>
          </div>
        </GradientCard>
      </div>

      {/* Top Keywords Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Top Search Terms
          </CardTitle>
          <CardDescription>
            Keywords that drive the most traffic to your listing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topKeywords.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topKeywords} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis 
                  dataKey="term" 
                  type="category" 
                  tick={{ fontSize: 12 }} 
                  stroke="hsl(var(--muted-foreground))" 
                  width={120}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="views" fill="hsl(var(--primary))" name="Views" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No search term data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keywords Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Keywords</CardTitle>
          <CardDescription>Detailed performance metrics by search term</CardDescription>
        </CardHeader>
        <CardContent>
          {topKeywords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Search Term</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Views</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Clicks</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">CTR</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Conversions</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords?.map((kw, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{kw.term}</td>
                      <td className="py-3 px-4 text-right">{kw.views.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{kw.clicks.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {kw.ctr > avgCTR ? (
                            <ArrowUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-red-500" />
                          )}
                          {kw.ctr.toFixed(1)}%
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">{kw.conversions}</td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant={kw.convRate > 5 ? 'default' : 'secondary'}>
                          {kw.convRate.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No keyword data available yet. Keywords will appear as customers search for your business.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
