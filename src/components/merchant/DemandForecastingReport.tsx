import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { GradientCard } from"@/components/ui/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Button } from"@/components/ui/button";
import { 
 TrendingUp, DollarSign, Calendar, Loader2, 
 Crown, Download, RefreshCw, Target, Lightbulb,
 Clock, Package, Users, BarChart3, Zap
} from"lucide-react";
import { 
 AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
 Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from"recharts";
import { useState } from"react";
import { toast } from"sonner";

const tooltipStyle = {
 backgroundColor:'hsl(var(--card))',
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px',
 padding:'8px 12px'
};

interface ForecastReport {
 generated_at: string;
 merchant_name: string;
 business_type: string;
 summary: {
 total_historical_transactions: number;
 total_historical_revenue: number;
 avg_daily_revenue: number;
 avg_transaction_value: number;
 forecast_confidence: string;
 predicted_90_day_revenue: number;
 predicted_growth_rate: number;
 };
 historical_analysis: {
 totalRevenue: number;
 avgDailyRevenue: number;
 avgTransactionValue: number;
 totalTransactions: number;
 peakDay: string;
 peakHour: string;
 dailyTrend: { date: string; revenue: number; transactions: number }[];
 weeklyAverage: { day: string; avgRevenue: number; avgTransactions: number }[];
 };
 forecast_90_day: {
 daily: { date: string; predicted_revenue: number; confidence: string }[];
 weekly: { week: string; predicted_revenue: number; growth_vs_prev: number }[];
 monthly: { month: string; predicted_revenue: number }[];
 totalPredictedRevenue: number;
 growthRate: number;
 };
 seasonal_trends: {
 monthly: { month: string; avgRevenue: number; totalRevenue: number; transactions: number }[];
 quarterly: { quarter: string; totalRevenue: number; transactions: number }[];
 peakSeason: string;
 lowSeason: string;
 seasonalVariance: number;
 };
 pricing_recommendations: { type: string; recommendation: string; impact: string; priority:'high' |'medium' |'low' }[];
 operational_recommendations: { category: string; recommendation: string; timing: string; priority:'high' |'medium' |'low' }[];
 ai_insights: string[];
}

export function DemandForecastingReport() {
 const [isRegenerating, setIsRegenerating] = useState(false);

 const { data: reportData, isLoading, refetch } = useQuery({
 queryKey: ['demand-forecast-report'],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke('merchant-generate-demand-forecast');
 if (error) throw error;
 return data as { has_access: boolean; report?: ForecastReport; message?: string };
 }
 });

 const handleRegenerate = async () => {
 setIsRegenerating(true);
 try {
 await refetch();
 toast.success('Forecast regenerated with latest data');
 } catch {
 toast.error('Failed to regenerate forecast');
 } finally {
 setIsRegenerating(false);
 }
 };

 const handleExport = () => {
 if (!reportData?.report) return;
 
 const report = reportData.report;
 const csvContent = [
 ['Predictive Demand Forecast Report'],
 ['Generated:', report.generated_at],
 ['Merchant:', report.merchant_name],
 [],
 ['90-Day Forecast Summary'],
 ['Predicted Revenue', `$${report.summary.predicted_90_day_revenue}`],
 ['Growth Rate', `${report.summary.predicted_growth_rate}%`],
 ['Confidence Level', report.summary.forecast_confidence],
 [],
 ['Weekly Forecast'],
 ['Week','Predicted Revenue','Growth vs Prev'],
 ...report.forecast_90_day.weekly.map(w => [
 w.week,
 `$${w.predicted_revenue}`,
 `${w.growth_vs_prev}%`
 ]),
 [],
 ['AI Insights'],
 ...report.ai_insights.map(i => [i]),
 ].map(row => row.join(',')).join('\n');

 const blob = new Blob([csvContent], { type:'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `demand-forecast-${new Date().toISOString().split('T')[0]}.csv`;
 a.click();
 URL.revokeObjectURL(url);
 toast.success('Forecast exported successfully');
 };

 const getPriorityColor = (priority: string) => {
 switch (priority) {
 case'high': return'bg-destructive/10 text-destructive border-destructive/20';
 case'medium': return'bg-warning/10 text-warning border-warning/20';
 default: return'bg-info/10 text-info border-info/20';
 }
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
 <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="font-semibold mb-2">Predictive Demand Forecasting</h3>
 <p className="text-muted-foreground text-sm max-w-md mx-auto">
 {reportData?.message ||'This premium feature must be assigned by an admin. Contact support for access to AI-powered demand forecasting.'}
 </p>
 </CardContent>
 </Card>
 );
 }

 const report = reportData.report;
 if (!report) return null;

 const { summary, historical_analysis, forecast_90_day, seasonal_trends, pricing_recommendations, operational_recommendations, ai_insights } = report;

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold">Predictive Demand Forecasting</h2>
 <p className="text-muted-foreground">
 AI-powered 90-day demand predictions with pricing & operational recommendations
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 Last updated: {new Date(report.generated_at).toLocaleString()}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
 <RefreshCw className={`h-4 w-4 mr-1 ${isRegenerating ?'animate-spin' :''}`} />
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
 <DollarSign className="h-5 w-5 text-primary" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">90-Day Forecast</p>
 <p className="text-2xl font-bold">${summary.predicted_90_day_revenue.toLocaleString()}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className={`p-3 rounded-xl ${summary.predicted_growth_rate >= 0 ?'bg-success/10' :'bg-destructive/10'}`}>
 <TrendingUp className={`h-5 w-5 ${summary.predicted_growth_rate >= 0 ?'text-success' :'text-destructive'}`} />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Predicted Growth</p>
 <p className="text-2xl font-bold">{summary.predicted_growth_rate >= 0 ?'+' :''}{summary.predicted_growth_rate}%</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-info/10">
 <Target className="h-5 w-5 text-info" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Confidence Level</p>
 <p className="text-2xl font-bold">{summary.forecast_confidence}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-accent/100/10">
 <BarChart3 className="h-5 w-5 text-accent0" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Avg Daily Revenue</p>
 <p className="text-2xl font-bold">${summary.avg_daily_revenue.toLocaleString()}</p>
 </div>
 </div>
 </GradientCard>
 </div>

 {/* AI Insights Banner */}
 <Card className="border-primary/20 bg-primary/5">
 <CardHeader className="pb-3">
 <CardTitle className="flex items-center gap-2 text-lg">
 <Zap className="h-5 w-5 text-primary" />
 AI-Powered Insights
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid gap-3">
 {ai_insights.map((insight, idx) => (
 <p key={idx} className="text-sm">{insight}</p>
 ))}
 </div>
 </CardContent>
 </Card>

 <Tabs defaultValue="forecast" className="space-y-6">
 <TabsList className="grid grid-cols-5 w-full max-w-2xl">
 <TabsTrigger value="forecast">Forecast</TabsTrigger>
 <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
 <TabsTrigger value="pricing">Pricing</TabsTrigger>
 <TabsTrigger value="operations">Operations</TabsTrigger>
 <TabsTrigger value="historical">Historical</TabsTrigger>
 </TabsList>

 {/* FORECAST TAB */}
 <TabsContent value="forecast" className="space-y-6">
 {/* Monthly Forecast */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {forecast_90_day.monthly.map((month, idx) => (
 <Card key={month.month}>
 <CardHeader className="pb-2">
 <CardTitle className="text-base flex items-center gap-2">
 <Calendar className="h-4 w-4" />
 {month.month}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-3xl font-bold text-primary">
 ${month.predicted_revenue.toLocaleString()}
 </p>
 <Badge variant="outline" className="mt-2">
 {idx === 0 ?'High' : idx === 1 ?'Medium' :'Low'} Confidence
 </Badge>
 </CardContent>
 </Card>
 ))}
 </div>

 {/* Weekly Forecast Chart */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <TrendingUp className="h-5 w-5" />
 13-Week Revenue Forecast
 </CardTitle>
 <CardDescription>Predicted weekly revenue for the next 90 days</CardDescription>
 </CardHeader>
 <CardContent>
 <ResponsiveContainer width="100%" height={350}>
 <AreaChart data={forecast_90_day.weekly}>
 <defs>
 <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="hsl(var(--chart-6))" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="hsl(var(--chart-6))" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <Tooltip 
 contentStyle={tooltipStyle}
 formatter={(value: number, name: string) => [
 name ==='predicted_revenue' ? `$${value.toLocaleString()}` : `${value}%`,
 name ==='predicted_revenue' ?'Predicted Revenue' :'Growth'
 ]}
 />
 <Area 
 type="monotone" 
 dataKey="predicted_revenue" 
 stroke="hsl(var(--chart-6))" 
 fill="url(#forecastGradient)"
 strokeWidth={2}
 />
 </AreaChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>

 {/* Weekly Details Table */}
 <Card>
 <CardHeader>
 <CardTitle>Weekly Forecast Details</CardTitle>
 <CardDescription>Week-by-week breakdown with growth metrics</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b">
 <th className="text-left py-3 px-2 font-medium">Week</th>
 <th className="text-right py-3 px-2 font-medium">Predicted Revenue</th>
 <th className="text-right py-3 px-2 font-medium">Growth vs Prev</th>
 </tr>
 </thead>
 <tbody>
 {forecast_90_day.weekly.map((week) => (
 <tr key={week.week} className="border-b hover:bg-muted/50">
 <td className="py-3 px-2 font-medium">{week.week}</td>
 <td className="py-3 px-2 text-right">${week.predicted_revenue.toLocaleString()}</td>
 <td className="py-3 px-2 text-right">
 <span className={week.growth_vs_prev >= 0 ?'text-success' :'text-destructive'}>
 {week.growth_vs_prev >= 0 ?'+' :''}{week.growth_vs_prev}%
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* SEASONAL TAB */}
 <TabsContent value="seasonal" className="space-y-6">
 {/* Season Summary */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Peak Season</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold text-success">{seasonal_trends.peakSeason}</p>
 <p className="text-sm text-muted-foreground">Highest demand period</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Low Season</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold text-warning">{seasonal_trends.lowSeason}</p>
 <p className="text-sm text-muted-foreground">Consider promotions</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Seasonal Variance</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{Math.round(seasonal_trends.seasonalVariance)}%</p>
 <p className="text-sm text-muted-foreground">Revenue fluctuation</p>
 </CardContent>
 </Card>
 </div>

 {/* Monthly Trends Chart */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Calendar className="h-5 w-5" />
 Monthly Revenue Patterns
 </CardTitle>
 <CardDescription>Historical revenue by month to identify seasonal trends</CardDescription>
 </CardHeader>
 <CardContent>
 {seasonal_trends.monthly.some(m => m.totalRevenue > 0) ? (
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={seasonal_trends.monthly}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <Tooltip 
 contentStyle={tooltipStyle}
 formatter={(value: number) => [`$${value.toLocaleString()}`,'Total Revenue']}
 />
 <Bar dataKey="totalRevenue" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 Need more transaction history to show seasonal trends.
 </div>
 )}
 </CardContent>
 </Card>

 {/* Quarterly Summary */}
 <Card>
 <CardHeader>
 <CardTitle>Quarterly Performance</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {seasonal_trends.quarterly.map((q) => (
 <div key={q.quarter} className="p-4 rounded-lg bg-muted/50 text-center">
 <p className="text-sm text-muted-foreground mb-1">{q.quarter}</p>
 <p className="text-xl font-bold">${q.totalRevenue.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground">{q.transactions} transactions</p>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* PRICING TAB */}
 <TabsContent value="pricing" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <DollarSign className="h-5 w-5" />
 Pricing Recommendations
 </CardTitle>
 <CardDescription>AI-generated pricing strategies based on demand patterns</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {pricing_recommendations.map((rec, idx) => (
 <div key={idx} className="p-4 rounded-lg border bg-card">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <h4 className="font-semibold">{rec.type}</h4>
 <Badge variant="outline" className={getPriorityColor(rec.priority)}>
 {rec.priority}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground mb-2">{rec.recommendation}</p>
 <div className="flex items-center gap-2 text-sm">
 <Lightbulb className="h-4 w-4 text-warning" />
 <span className="text-warning">{rec.impact}</span>
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* OPERATIONS TAB */}
 <TabsContent value="operations" className="space-y-6">
 {/* Peak Performance */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base flex items-center gap-2">
 <Calendar className="h-4 w-4" />
 Peak Day
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{historical_analysis.peakDay ||'N/A'}</p>
 <p className="text-sm text-muted-foreground">Schedule more staff</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base flex items-center gap-2">
 <Clock className="h-4 w-4" />
 Peak Hours
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{historical_analysis.peakHour ||'N/A'}</p>
 <p className="text-sm text-muted-foreground">Busiest time of day</p>
 </CardContent>
 </Card>
 </div>

 {/* Operational Recommendations */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Package className="h-5 w-5" />
 Operational Recommendations
 </CardTitle>
 <CardDescription>Staffing, inventory, and capacity planning suggestions</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {operational_recommendations.map((rec, idx) => (
 <div key={idx} className="p-4 rounded-lg border bg-card">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <Badge variant="secondary">{rec.category}</Badge>
 <Badge variant="outline" className={getPriorityColor(rec.priority)}>
 {rec.priority}
 </Badge>
 </div>
 <p className="text-sm mb-2">{rec.recommendation}</p>
 <p className="text-xs text-muted-foreground">
 <Clock className="h-3 w-3 inline mr-1" />
 Timing: {rec.timing}
 </p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Weekly Pattern */}
 <Card>
 <CardHeader>
 <CardTitle>Weekly Demand Pattern</CardTitle>
 <CardDescription>Average revenue by day of week</CardDescription>
 </CardHeader>
 <CardContent>
 {historical_analysis.weeklyAverage.some(d => d.avgRevenue > 0) ? (
 <ResponsiveContainer width="100%" height={250}>
 <BarChart data={historical_analysis.weeklyAverage}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <Tooltip 
 contentStyle={tooltipStyle}
 formatter={(value: number) => [`$${value.toFixed(2)}`,'Avg Revenue']}
 />
 <Bar dataKey="avgRevenue" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 Need more transaction history to show weekly patterns.
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* HISTORICAL TAB */}
 <TabsContent value="historical" className="space-y-6">
 {/* Historical Summary */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Total Revenue</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">${historical_analysis.totalRevenue.toLocaleString()}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Transactions</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{historical_analysis.totalTransactions.toLocaleString()}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Avg Daily Revenue</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">${historical_analysis.avgDailyRevenue.toLocaleString()}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Avg Transaction</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">${historical_analysis.avgTransactionValue.toLocaleString()}</p>
 </CardContent>
 </Card>
 </div>

 {/* Historical Trend Chart */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <BarChart3 className="h-5 w-5" />
 Last 30 Days Performance
 </CardTitle>
 <CardDescription>Daily revenue and transaction count</CardDescription>
 </CardHeader>
 <CardContent>
 {historical_analysis.dailyTrend.length > 0 ? (
 <ResponsiveContainer width="100%" height={300}>
 <LineChart data={historical_analysis.dailyTrend}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis 
 dataKey="date" 
 tick={{ fontSize: 10 }} 
 stroke="hsl(var(--muted-foreground))"
 tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
 />
 <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <Tooltip 
 contentStyle={tooltipStyle}
 formatter={(value: number, name: string) => [
 name ==='revenue' ? `$${value.toFixed(2)}` : value,
 name ==='revenue' ?'Revenue' :'Transactions'
 ]}
 labelFormatter={(label) => new Date(label).toLocaleDateString()}
 />
 <Legend />
 <Line 
 yAxisId="left"
 type="monotone" 
 dataKey="revenue" 
 stroke="hsl(var(--chart-3))" 
 strokeWidth={2}
 dot={false}
 />
 <Line 
 yAxisId="right"
 type="monotone" 
 dataKey="transactions" 
 stroke="hsl(var(--chart-2))" 
 strokeWidth={2}
 dot={false}
 />
 </LineChart>
 </ResponsiveContainer>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 No historical data available yet. Make some sales to see trends.
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
}
