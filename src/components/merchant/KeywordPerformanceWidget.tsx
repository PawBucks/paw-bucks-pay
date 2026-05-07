import { useState } from"react";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { GradientCard } from"@/components/ui/gradient-card";
import { Search, Eye, MousePointerClick, TrendingUp, Loader2, ArrowUp, ArrowDown, RefreshCw, Download, Lightbulb, Target, BarChart3, PieChart, AlertTriangle, CheckCircle, Info, ExternalLink } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import { 
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
 LineChart, Line, PieChart as RePieChart, Pie, Cell, Legend, Area, AreaChart
} from"recharts";
import { toast } from"sonner";

import { Formatters } from "@/utils/formatters";
interface KeywordData {
 term: string;
 views: number;
 clicks: number;
 conversions: number;
 ctr: number;
 conversionRate: number;
 trend: number;
}

interface TrafficSource {
 name: string;
 views: number;
 clicks: number;
 conversions: number;
 percentage: number;
 topTerms: string[];
}

interface AIInsight {
 type:'success' |'warning' |'info' |'opportunity';
 title: string;
 description: string;
 action: string;
}

interface KeywordRecommendation {
 keyword: string;
 reason: string;
 priority:'high' |'medium' |'low';
 estimatedImpact: string;
 suggestedAction: string;
}

interface CompetitorGap {
 keyword: string;
 competitorUsage: number;
 yourUsage: number;
 gap: number;
 opportunity: string;
}

interface SEORecommendation {
 category: string;
 title: string;
 description: string;
 impact:'high' |'medium' |'low';
 effort:'easy' |'moderate' |'complex';
}

interface KeywordReport {
 generated_at: string;
 merchant_id: string;
 business_name: string;
 business_type: string;
 report_period: { start: string; end: string };
 totals: {
 totalViews: number;
 totalClicks: number;
 totalConversions: number;
 avgCTR: number;
 avgConversionRate: number;
 totalTransactions: number;
 totalRevenue: number;
 };
 keywords: KeywordData[];
 trafficSources: Record<string, TrafficSource>;
 searchTrends: { week: string; views: number; clicks: number; conversions: number; ctr: number }[];
 recommendations: KeywordRecommendation[];
 competitorGaps: CompetitorGap[];
 aiInsights: AIInsight[];
 seoRecommendations: SEORecommendation[];
}

const CHART_COLORS = ['hsl(var(--chart-1))','hsl(var(--chart-2))','hsl(var(--chart-3))','hsl(var(--chart-4))','hsl(var(--chart-5))','hsl(var(--chart-6))','hsl(var(--chart-7))','hsl(var(--chart-8))'];

export function KeywordPerformanceWidget() {
 const [activeTab, setActiveTab] = useState('overview');

 const { data: report, isLoading, refetch, isRefetching } = useQuery<KeywordReport>({
 queryKey: ['keyword-insights-report'],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke('merchant-generate-keyword-insights');
 if (error) throw error;
 if (data?.error) throw new Error(data.message || data.error);
 return data;
 },
 retry: false
 });

 const handleExport = () => {
 if (!report) return;
 
 const csvContent = [
 ['Keyword Performance Report', report.business_name],
 ['Report Period', `${report.report_period.start} to ${report.report_period.end}`],
 ['Generated', new Date(report.generated_at).toLocaleDateString()],
 [],
 ['Search Term','Views','Clicks','CTR (%)','Conversions','Conv. Rate (%)','Trend (%)'],
 ...report.keywords.map(k => [
 k.term, k.views, k.clicks, Formatters.money(k.ctr), k.conversions, Formatters.money(k.conversionRate), Formatters.decimal(k.trend, 1)
 ])
 ].map(row => row.join(',')).join('\n');

 const blob = new Blob([csvContent], { type:'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `keyword-report-${report.report_period.end}.csv`;
 a.click();
 toast.success('Report exported successfully');
 };

 if (isLoading) {
 return (
 <div className="flex flex-col items-center justify-center py-12 gap-4">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 <p className="text-muted-foreground">Generating keyword insights...</p>
 </div>
 );
 }

 if (!report) {
 return (
 <Card className="border-dashed">
 <CardContent className="py-12 text-center">
 <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="font-semibold mb-2">Keyword Performance Insights</h3>
 <p className="text-muted-foreground text-sm mb-4">
 Purchase this service from the Merchant Market to discover which search terms bring customers to your business
 </p>
 <Button variant="outline" asChild>
 <a href="/merchant/market">View Merchant Market</a>
 </Button>
 </CardContent>
 </Card>
 );
 }

 const { totals, keywords, trafficSources, searchTrends, recommendations, competitorGaps, aiInsights, seoRecommendations } = report;

 const pieData = Object.values(trafficSources).map(source => ({
 name: source.name,
 value: source.views,
 percentage: source.percentage
 }));

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold">Keyword Performance Insights</h2>
 <p className="text-muted-foreground">
 Discover which search terms drive customers to your business
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Badge className="bg-gradient-to-r from-warning to-warning">
 {report.report_period.start} - {report.report_period.end}
 </Badge>
 <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
 <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ?'animate-spin' :''}`} />
 Refresh
 </Button>
 <Button variant="outline" size="sm" onClick={handleExport}>
 <Download className="h-4 w-4 mr-2" />
 Export
 </Button>
 </div>
 </div>

 {/* Summary Metrics */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-primary/10">
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
 <div className="p-3 rounded-md bg-info/10">
 <MousePointerClick className="h-5 w-5 text-info" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Clicks</p>
 <p className="text-2xl font-bold">{totals.totalClicks.toLocaleString()}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-success/10">
 <TrendingUp className="h-5 w-5 text-success" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Avg CTR</p>
 <p className="text-2xl font-bold">{Formatters.decimal(totals.avgCTR, 1)}%</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-accent/10">
 <Target className="h-5 w-5 text-accent" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Conversions</p>
 <p className="text-2xl font-bold">{totals.totalConversions.toLocaleString()}</p>
 </div>
 </div>
 </GradientCard>
 </div>

 {/* AI Insights */}
 {aiInsights.length > 0 && (
 <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Sparkles className="h-5 w-5 text-primary" />
 AI-Powered Insights
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {aiInsights.map((insight, idx) => (
 <div key={idx} className="flex gap-3 p-4 rounded-lg bg-card border">
 {insight.type ==='success' && <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />}
 {insight.type ==='warning' && <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />}
 {insight.type ==='info' && <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />}
 {insight.type ==='opportunity' && <Lightbulb className="h-5 w-5 text-accent shrink-0 mt-0.5" />}
 <div className="space-y-1">
 <p className="font-medium">{insight.title}</p>
 <p className="text-sm text-muted-foreground">{insight.description}</p>
 <p className="text-sm text-primary font-medium">→ {insight.action}</p>
 </div>
 </div>
 ))}
 </CardContent>
 </Card>
 )}

 {/* Tabs */}
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="grid w-full grid-cols-5">
 <TabsTrigger value="overview">Overview</TabsTrigger>
 <TabsTrigger value="keywords">Keywords</TabsTrigger>
 <TabsTrigger value="traffic">Traffic</TabsTrigger>
 <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
 <TabsTrigger value="seo">SEO</TabsTrigger>
 </TabsList>

 {/* Overview Tab */}
 <TabsContent value="overview" className="space-y-6">
 <div className="grid lg:grid-cols-2 gap-6">
 {/* Search Trends Chart */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <BarChart3 className="h-5 w-5" />
 Search Trends (Last 90 Days)
 </CardTitle>
 </CardHeader>
 <CardContent>
 {searchTrends.length > 0 ? (
 <ResponsiveContainer width="100%" height={300}>
 <AreaChart data={searchTrends}>
 <defs>
 <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="hsl(var(--chart-6))" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="hsl(var(--chart-6))" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis 
 dataKey="week" 
 tick={{ fontSize: 11 }} 
 stroke="hsl(var(--muted-foreground))"
 tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
 />
 <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
 <Tooltip 
 contentStyle={{ 
 backgroundColor:'hsl(var(--card))', 
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px'
 }}
 />
 <Area 
 type="monotone" 
 dataKey="views" 
 stroke="hsl(var(--chart-6))" 
 fillOpacity={1} 
 fill="url(#colorViews)" 
 name="Views"
 />
 <Line type="monotone" dataKey="clicks" stroke="hsl(var(--chart-2))" name="Clicks" strokeWidth={2} />
 </AreaChart>
 </ResponsiveContainer>
 ) : (
 <div className="flex items-center justify-center h-[300px] text-muted-foreground">
 No trend data available yet
 </div>
 )}
 </CardContent>
 </Card>

 {/* Traffic Sources Pie */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <PieChart className="h-5 w-5" />
 Traffic Source Breakdown
 </CardTitle>
 </CardHeader>
 <CardContent>
 {pieData.some(d => d.value > 0) ? (
 <ResponsiveContainer width="100%" height={300}>
 <RePieChart>
 <Pie
 data={pieData}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={100}
 paddingAngle={2}
 dataKey="value"
 label={({ name, percentage }) => `${name}: ${Formatters.number(Math.round(percentage))}%`}
 labelLine={false}
 >
 {pieData.map((_, index) => (
 <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
 ))}
 </Pie>
 <Tooltip 
 contentStyle={{ 
 backgroundColor:'hsl(var(--card))', 
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px'
 }}
 />
 </RePieChart>
 </ResponsiveContainer>
 ) : (
 <div className="flex items-center justify-center h-[300px] text-muted-foreground">
 No traffic data available yet
 </div>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Top Keywords */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Search className="h-5 w-5" />
 Top Performing Keywords
 </CardTitle>
 <CardDescription>Keywords driving the most traffic to your listing</CardDescription>
 </CardHeader>
 <CardContent>
 {keywords.length > 0 ? (
 <ResponsiveContainer width="100%" height={350}>
 <BarChart data={keywords.slice(0, 10)} layout="vertical">
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <YAxis 
 dataKey="term" 
 type="category" 
 tick={{ fontSize: 12 }} 
 stroke="hsl(var(--muted-foreground))" 
 width={140}
 />
 <Tooltip 
 contentStyle={{ 
 backgroundColor:'hsl(var(--card))', 
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px'
 }}
 />
 <Bar dataKey="views" fill="hsl(var(--chart-6))" name="Views" radius={[0, 4, 4, 0]} />
 <Bar dataKey="clicks" fill="hsl(var(--chart-4))" name="Clicks" radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 No keyword data available yet. Keywords will appear as customers search for your business.
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* Keywords Tab */}
 <TabsContent value="keywords">
 <Card>
 <CardHeader>
 <CardTitle>All Keywords</CardTitle>
 <CardDescription>Detailed performance metrics for all tracked search terms</CardDescription>
 </CardHeader>
 <CardContent>
 {keywords.length > 0 ? (
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
 <th className="text-right py-3 px-4 font-medium text-muted-foreground">Trend</th>
 </tr>
 </thead>
 <tbody>
 {keywords.map((kw, idx) => (
 <tr key={idx} className="border-b border-border/50 hover:bg-muted">
 <td className="py-3 px-4 font-medium">{kw.term}</td>
 <td className="py-3 px-4 text-right">{kw.views.toLocaleString()}</td>
 <td className="py-3 px-4 text-right">{kw.clicks.toLocaleString()}</td>
 <td className="py-3 px-4 text-right">
 <div className="flex items-center justify-end gap-1">
 {kw.ctr > totals.avgCTR ? (
 <ArrowUp className="h-3 w-3 text-success" />
 ) : (
 <ArrowDown className="h-3 w-3 text-destructive" />
 )}
 {Formatters.decimal(kw.ctr, 1)}%
 </div>
 </td>
 <td className="py-3 px-4 text-right">{kw.conversions}</td>
 <td className="py-3 px-4 text-right">
 <Badge variant={kw.conversionRate > 5 ?'default' :'secondary'}>
 {Formatters.decimal(kw.conversionRate, 1)}%
 </Badge>
 </td>
 <td className="py-3 px-4 text-right">
 <span className={kw.trend >= 0 ?'text-success' :'text-destructive'}>
 {kw.trend >= 0 ?'+' :''}{Formatters.number(Math.round(kw.trend))}%
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 No keyword data available yet
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* Traffic Tab */}
 <TabsContent value="traffic" className="space-y-6">
 <div className="grid md:grid-cols-2 gap-6">
 {Object.values(trafficSources).map((source, idx) => (
 <Card key={idx}>
 <CardHeader>
 <CardTitle className="text-lg">{source.name}</CardTitle>
 <CardDescription>{Formatters.decimal(source.percentage, 1)}% of total traffic</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-3 gap-4 text-center">
 <div>
 <p className="text-2xl font-bold">{source.views.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground">Views</p>
 </div>
 <div>
 <p className="text-2xl font-bold">{source.clicks.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground">Clicks</p>
 </div>
 <div>
 <p className="text-2xl font-bold">{source.conversions}</p>
 <p className="text-xs text-muted-foreground">Conversions</p>
 </div>
 </div>
 {source.topTerms.length > 0 && (
 <div>
 <p className="text-sm font-medium mb-2">Top Terms:</p>
 <div className="flex flex-wrap gap-2">
 {source.topTerms.map((term, i) => (
 <Badge key={i} variant="secondary">{term}</Badge>
 ))}
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 ))}
 </div>
 </TabsContent>

 {/* Recommendations Tab */}
 <TabsContent value="recommendations" className="space-y-6">
 {/* Keyword Recommendations */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Lightbulb className="h-5 w-5 text-warning" />
 Recommended Keywords
 </CardTitle>
 <CardDescription>Keywords you should target based on your business type</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {recommendations.map((rec, idx) => (
 <div key={idx} className="flex items-start gap-4 p-4 rounded-lg border bg-card">
 <Badge variant={rec.priority ==='high' ?'default' : rec.priority ==='medium' ?'secondary' :'outline'}>
 {rec.priority}
 </Badge>
 <div className="flex-1 space-y-1">
 <p className="font-medium">"{rec.keyword}"</p>
 <p className="text-sm text-muted-foreground">{rec.reason}</p>
 <p className="text-xs text-muted-foreground">
 Estimated impact: {rec.estimatedImpact}
 </p>
 </div>
 <Button variant="ghost" size="sm" className="shrink-0">
 <ExternalLink className="h-4 w-4" />
 </Button>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Competitor Gaps */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Target className="h-5 w-5 text-destructive" />
 Competitor Keyword Gaps
 </CardTitle>
 <CardDescription>Keywords your competitors are ranking for that you're missing</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {competitorGaps.map((gap, idx) => (
 <div key={idx} className="p-4 rounded-lg border bg-card">
 <div className="flex items-center justify-between mb-2">
 <span className="font-medium">"{gap.keyword}"</span>
 <Badge variant="destructive">{gap.gap}% gap</Badge>
 </div>
 <p className="text-sm text-muted-foreground mb-2">{gap.opportunity}</p>
 <div className="flex items-center gap-4 text-xs">
 <span>Competitor usage: <strong>{gap.competitorUsage}%</strong></span>
 <span>Your usage: <strong>{gap.yourUsage}</strong> views</span>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* SEO Tab */}
 <TabsContent value="seo">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Search className="h-5 w-5" />
 SEO Recommendations
 </CardTitle>
 <CardDescription>Actionable steps to improve your search visibility</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {seoRecommendations.map((rec, idx) => (
 <div key={idx} className="p-4 rounded-lg border bg-card">
 <div className="flex items-start justify-between gap-4 mb-2">
 <div>
 <Badge variant="outline" className="mb-2">{rec.category}</Badge>
 <p className="font-medium">{rec.title}</p>
 </div>
 <div className="flex gap-2">
 <Badge variant={rec.impact ==='high' ?'default' : rec.impact ==='medium' ?'secondary' :'outline'}>
 {rec.impact} impact
 </Badge>
 <Badge variant="outline">{rec.effort}</Badge>
 </div>
 </div>
 <p className="text-sm text-muted-foreground">{rec.description}</p>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
}
