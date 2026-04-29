import { useQuery, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Calendar } from"@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from"@/components/ui/popover";
import { 
 Users, TrendingUp, Target, BarChart3, Activity, DollarSign, 
 ArrowUpRight, ArrowDownRight, Clock, Calendar as CalendarIcon, AlertCircle,
 Crown, UserCheck, Repeat, Loader2, Lightbulb, Star, Download, RefreshCw,
 Brain, Rocket, Heart, AlertTriangle, Zap, UserMinus, UserPlus
} from"lucide-react";
import { 
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
 LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend, RadialBarChart, RadialBar
} from"recharts";
import { useMemo, useState } from"react";
import { format, subDays } from"date-fns";
import { toast } from"sonner";
import jsPDF from"jspdf";

const COLORS = ['hsl(var(--primary))','hsl(var(--chart-2))','hsl(var(--chart-3))','hsl(var(--chart-4))','hsl(var(--chart-5))'];

const tooltipStyle = {
 backgroundColor:'hsl(var(--card))',
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px',
 padding:'8px 12px'
};

interface DateRange {
 from: Date;
 to: Date;
}

export function PremiumAnalyticsDashboard() {
 const queryClient = useQueryClient();
 const [dateRange, setDateRange] = useState<DateRange>({
 from: subDays(new Date(), 30),
 to: new Date()
 });
 const [isExporting, setIsExporting] = useState(false);

 const { data: analyticsData, isLoading, error, isFetching } = useQuery({
 queryKey: ['premium-analytics', dateRange.from.toISOString(), dateRange.to.toISOString()],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke('merchant-get-premium-analytics', {
 body: { startDate: dateRange.from.toISOString(), endDate: dateRange.to.toISOString() }
 });
 if (error) throw error;
 return data;
 }
 });

 const handleRefresh = () => {
 queryClient.invalidateQueries({ queryKey: ['premium-analytics'] });
 toast.success('Analytics refreshed');
 };

 const handleExportPDF = async () => {
 if (!analyticsData?.analytics) return;
 setIsExporting(true);
 
 try {
 const pdf = new jsPDF();
 const { analytics } = analyticsData;
 
 pdf.setFontSize(20);
 pdf.text('Premium Analytics Report', 20, 20);
 pdf.setFontSize(10);
 pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 28);
 pdf.text(`Date Range: ${format(dateRange.from,'MMM d, yyyy')} - ${format(dateRange.to,'MMM d, yyyy')}`, 20, 35);

 pdf.setFontSize(14);
 pdf.text('Overview', 20, 50);
 pdf.setFontSize(10);
 pdf.text(`Total Revenue: $${analytics.overview.total_revenue.toLocaleString()}`, 25, 58);
 pdf.text(`Total Transactions: ${analytics.overview.total_transactions}`, 25, 65);
 pdf.text(`Unique Customers: ${analytics.overview.unique_customers}`, 25, 72);
 pdf.text(`Average Order Value: $${analytics.overview.avg_transaction_value}`, 25, 79);

 pdf.setFontSize(14);
 pdf.text('Transaction Velocity', 20, 95);
 pdf.setFontSize(10);
 pdf.text(`Daily Transactions: ${analytics.transaction_velocity.daily_transactions}`, 25, 103);
 pdf.text(`Daily Revenue: $${analytics.transaction_velocity.daily_revenue}`, 25, 110);
 pdf.text(`Velocity Growth: ${analytics.transaction_velocity.velocity_growth}%`, 25, 117);

 pdf.setFontSize(14);
 pdf.text('Customer Insights', 20, 133);
 pdf.setFontSize(10);
 pdf.text(`Repeat Purchase Rate: ${analytics.customer_insights.metrics.repeat_purchase_rate}%`, 25, 141);
 pdf.text(`Average Lifetime Value: $${analytics.customer_insights.metrics.avg_lifetime_value}`, 25, 148);
 pdf.text(`New Customers: ${analytics.customer_insights.demographics.new_customers}`, 25, 155);
 pdf.text(`Returning Customers: ${analytics.customer_insights.demographics.returning_customers}`, 25, 162);
 pdf.text(`Churn Risk: ${analytics.customer_insights.demographics.churn_risk_customers}`, 25, 169);

 pdf.setFontSize(14);
 pdf.text('Performance Score', 20, 185);
 pdf.setFontSize(10);
 pdf.text(`Overall Score: ${analytics.competitive_benchmarking.overall_performance_score}/100`, 25, 193);

 if (analytics.ai_insights?.length > 0) {
 pdf.setFontSize(14);
 pdf.text('AI Insights', 20, 210);
 pdf.setFontSize(10);
 analytics.ai_insights.slice(0, 3).forEach((insight: any, idx: number) => {
 pdf.text(`• ${insight.title}: ${insight.description.slice(0, 80)}...`, 25, 218 + (idx * 10));
 });
 }

 pdf.save(`premium-analytics-${format(new Date(),'yyyy-MM-dd')}.pdf`);
 toast.success('Report exported successfully');
 } catch (err) {
 toast.error('Failed to export report');
 } finally {
 setIsExporting(false);
 }
 };

 const handleExportCSV = () => {
 if (!analyticsData?.analytics) return;
 const { analytics } = analyticsData;
 
 const csvRows = [
 ['Premium Analytics Report'],
 [`Generated: ${new Date().toLocaleString()}`],
 [`Date Range: ${format(dateRange.from,'MMM d, yyyy')} - ${format(dateRange.to,'MMM d, yyyy')}`],
 [],
 ['Metric','Value'],
 ['Total Revenue', `$${analytics.overview.total_revenue}`],
 ['Total Transactions', analytics.overview.total_transactions],
 ['Unique Customers', analytics.overview.unique_customers],
 ['Avg Order Value', `$${analytics.overview.avg_transaction_value}`],
 ['Daily Transaction Velocity', analytics.transaction_velocity.daily_transactions],
 ['Daily Revenue Velocity', `$${analytics.transaction_velocity.daily_revenue}`],
 ['Repeat Purchase Rate', `${analytics.customer_insights.metrics.repeat_purchase_rate}%`],
 ['Avg Lifetime Value', `$${analytics.customer_insights.metrics.avg_lifetime_value}`],
 ['Performance Score', analytics.competitive_benchmarking.overall_performance_score],
 [],
 ['Daily Revenue Trend'],
 ['Date','Revenue','Transactions'],
 ...analytics.revenue_trends.daily.map((d: any) => [d.date, d.revenue, d.transactions])
 ];
 
 const csvContent = csvRows.map(row => row.join(',')).join('\n');
 const blob = new Blob([csvContent], { type:'text/csv' });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `premium-analytics-${format(new Date(),'yyyy-MM-dd')}.csv`;
 a.click();
 window.URL.revokeObjectURL(url);
 toast.success('CSV exported successfully');
 };

 const formattedData = useMemo(() => {
 if (!analyticsData?.analytics) return null;
 return analyticsData.analytics;
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
 {analyticsData?.message ||'This premium feature must be assigned by an admin. Contact support for access to advanced analytics.'}
 </p>
 </CardContent>
 </Card>
 );
 }

 if (!formattedData) return null;

 const { overview, period_comparison, transaction_velocity, revenue_trends, customer_insights, transaction_patterns, ai_insights, growth_opportunities, competitive_benchmarking } = formattedData;

 // Customer segments pie chart data
 const segmentsData = [
 { name:'One-time', value: customer_insights.segments.one_time_buyers, color: COLORS[0] },
 { name:'Repeat', value: customer_insights.segments.repeat_buyers, color: COLORS[1] },
 { name:'Loyal (5+)', value: customer_insights.segments.loyal_customers, color: COLORS[2] },
 { name:'VIP ($500+)', value: customer_insights.segments.vip_customers, color: COLORS[3] },
 ].filter(s => s.value > 0);

 // Spending tiers data
 const spendingTiersData = [
 { name:'Budget (<$50)', value: customer_insights.demographics.spending_tiers.budget, fill: COLORS[0] },
 { name:'Mid ($50-200)', value: customer_insights.demographics.spending_tiers.mid_range, fill: COLORS[1] },
 { name:'Premium ($200-500)', value: customer_insights.demographics.spending_tiers.premium, fill: COLORS[2] },
 { name:'High Value ($500+)', value: customer_insights.demographics.spending_tiers.high_value, fill: COLORS[3] },
 ].filter(s => s.value > 0);

 // Performance score for radial chart
 const performanceData = [{
 name:'Score',
 value: competitive_benchmarking.overall_performance_score,
 fill: competitive_benchmarking.overall_performance_score >= 70 ?'hsl(var(--chart-2))' : 
 competitive_benchmarking.overall_performance_score >= 40 ?'hsl(var(--chart-4))' :'hsl(var(--destructive))'
 }];

 const getGrowthIcon = (value: number) => {
 if (value > 0) return <ArrowUpRight className="h-4 w-4 text-success" />;
 if (value < 0) return <ArrowDownRight className="h-4 w-4 text-destructive" />;
 return null;
 };

 const getGrowthColor = (value: number) => {
 if (value > 0) return'text-success';
 if (value < 0) return'text-destructive';
 return'text-muted-foreground';
 };

 const getImpactBadge = (impact: string) => {
 switch (impact) {
 case'critical':
 return <Badge variant="destructive">Critical</Badge>;
 case'high':
 return <Badge className="bg-warning">High Priority</Badge>;
 case'positive':
 return <Badge className="bg-success">Positive</Badge>;
 default:
 return <Badge variant="secondary">Medium</Badge>;
 }
 };

 const getInsightIcon = (type: string) => {
 switch (type) {
 case'positive': return <Heart className="h-5 w-5 text-success" />;
 case'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
 case'prediction': return <TrendingUp className="h-5 w-5 text-info" />;
 case'opportunity': return <Zap className="h-5 w-5 text-warning" />;
 default: return <Brain className="h-5 w-5 text-primary" />;
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold">Premium Analytics Dashboard</h2>
 <p className="text-muted-foreground">Advanced business intelligence and growth insights</p>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 {/* Date Range Picker */}
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" size="sm" className="gap-2">
 <CalendarIcon className="h-4 w-4" />
 {format(dateRange.from,'MMM d')} - {format(dateRange.to,'MMM d, yyyy')}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="end">
 <Calendar
 mode="range"
 selected={{ from: dateRange.from, to: dateRange.to }}
 onSelect={(range) => {
 if (range?.from && range?.to) {
 setDateRange({ from: range.from, to: range.to });
 }
 }}
 numberOfMonths={2}
 />
 <div className="p-3 border-t flex gap-2">
 <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>7 Days</Button>
 <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>30 Days</Button>
 <Button size="sm" variant="outline" onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}>90 Days</Button>
 </div>
 </PopoverContent>
 </Popover>
 
 <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
 <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ?'animate-spin' :''}`} />
 Refresh
 </Button>
 
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" size="sm">
 <Download className="h-4 w-4 mr-2" />
 Export
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-40 p-2" align="end">
 <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleExportPDF} disabled={isExporting}>
 {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
 Export PDF
 </Button>
 <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleExportCSV}>
 Export CSV
 </Button>
 </PopoverContent>
 </Popover>
 
 <Badge className="bg-gradient-to-r from-primary to-primary/60 gap-1">
 <Crown className="h-3 w-3" /> Premium
 </Badge>
 </div>
 </div>

 <Tabs defaultValue="overview" className="space-y-6">
 <TabsList className="grid grid-cols-6 w-full max-w-3xl">
 <TabsTrigger value="overview">Overview</TabsTrigger>
 <TabsTrigger value="velocity">Velocity</TabsTrigger>
 <TabsTrigger value="customers">Customers</TabsTrigger>
 <TabsTrigger value="patterns">Patterns</TabsTrigger>
 <TabsTrigger value="ai">AI Insights</TabsTrigger>
 <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
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
 <div className="p-3 rounded-xl bg-success/10">
 <Users className="h-5 w-5 text-success" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Customers</p>
 <p className="text-2xl font-bold">{overview.unique_customers}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-info/10">
 <Activity className="h-5 w-5 text-info" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Total Transactions</p>
 <p className="text-2xl font-bold">{overview.total_transactions}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-accent/10">
 <TrendingUp className="h-5 w-5 text-accent" />
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
 <CalendarIcon className="h-5 w-5" />
 Period Performance
 </CardTitle>
 <CardDescription>Comparison with previous period</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-sm text-muted-foreground mb-1">Revenue</p>
 <p className="text-3xl font-bold">${period_comparison.current_period.revenue.toLocaleString()}</p>
 <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(period_comparison.growth.revenue)}`}>
 {getGrowthIcon(period_comparison.growth.revenue)}
 <span className="text-sm font-medium">{period_comparison.growth.revenue.toFixed(1)}%</span>
 </div>
 </div>
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-sm text-muted-foreground mb-1">Transactions</p>
 <p className="text-3xl font-bold">{period_comparison.current_period.transactions}</p>
 <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(period_comparison.growth.transactions)}`}>
 {getGrowthIcon(period_comparison.growth.transactions)}
 <span className="text-sm font-medium">{period_comparison.growth.transactions.toFixed(1)}%</span>
 </div>
 </div>
 <div className="text-center p-4 rounded-lg bg-muted">
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

 {/* Revenue Chart */}
 <Card>
 <CardHeader>
 <CardTitle>Revenue Trend</CardTitle>
 </CardHeader>
 <CardContent>
 <ResponsiveContainer width="100%" height={250}>
 <AreaChart data={revenue_trends.daily}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis 
 dataKey="date" 
 tick={{ fontSize: 12 }} 
 stroke="hsl(var(--muted-foreground))"
 tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
 />
 <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <Tooltip 
 contentStyle={tooltipStyle}
 formatter={(value: number) => [`$${value.toFixed(2)}`,'Revenue']}
 labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
 />
 <Area 
 type="monotone" 
 dataKey="revenue" 
 stroke="hsl(var(--chart-6))" 
 fill="hsl(var(--chart-6)/0.2)"
 strokeWidth={2}
 />
 </AreaChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 </TabsContent>

 {/* VELOCITY TAB */}
 <TabsContent value="velocity" className="space-y-6">
 {/* Velocity Metrics */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-primary/10">
 <Rocket className="h-5 w-5 text-primary" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Daily Transactions</p>
 <p className="text-2xl font-bold">{transaction_velocity.daily_transactions}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-success/10">
 <DollarSign className="h-5 w-5 text-success" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Daily Revenue</p>
 <p className="text-2xl font-bold">${transaction_velocity.daily_revenue}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-info/10">
 <Activity className="h-5 w-5 text-info" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Weekly Revenue</p>
 <p className="text-2xl font-bold">${transaction_velocity.weekly_revenue}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-accent/10">
 <TrendingUp className="h-5 w-5 text-accent" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Velocity Growth</p>
 <div className="flex items-center gap-1">
 <p className={`text-2xl font-bold ${getGrowthColor(transaction_velocity.velocity_growth)}`}>
 {transaction_velocity.velocity_growth > 0 ?'+' :''}{transaction_velocity.velocity_growth}%
 </p>
 {getGrowthIcon(transaction_velocity.velocity_growth)}
 </div>
 </div>
 </div>
 </GradientCard>
 </div>

 {/* Projections */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <TrendingUp className="h-5 w-5" />
 Projected Performance
 </CardTitle>
 <CardDescription>Based on current velocity trends</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="text-center p-6 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border">
 <p className="text-sm text-muted-foreground mb-2">Projected Monthly Revenue</p>
 <p className="text-4xl font-bold text-primary">${transaction_velocity.projected_monthly_revenue.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground mt-2">Based on ${transaction_velocity.daily_revenue}/day avg</p>
 </div>
 <div className="text-center p-6 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border">
 <p className="text-sm text-muted-foreground mb-2">Projected Monthly Transactions</p>
 <p className="text-4xl font-bold text-success">{transaction_velocity.projected_monthly_transactions}</p>
 <p className="text-xs text-muted-foreground mt-2">Based on {transaction_velocity.daily_transactions}/day avg</p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Monthly Revenue Chart */}
 <Card>
 <CardHeader>
 <CardTitle>Monthly Revenue Trend (12 Months)</CardTitle>
 </CardHeader>
 <CardContent>
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={revenue_trends.monthly}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <Tooltip 
 contentStyle={tooltipStyle}
 formatter={(value: number) => [`$${value.toFixed(2)}`,'Revenue']}
 />
 <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 </TabsContent>

 {/* CUSTOMERS TAB */}
 <TabsContent value="customers" className="space-y-6">
 {/* Customer Demographics */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-success/10">
 <UserPlus className="h-5 w-5 text-success" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">New Customers</p>
 <p className="text-2xl font-bold">{customer_insights.demographics.new_customers}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-info/10">
 <Repeat className="h-5 w-5 text-info" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Returning</p>
 <p className="text-2xl font-bold">{customer_insights.demographics.returning_customers}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-warning/10">
 <UserMinus className="h-5 w-5 text-warning" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Churn Risk</p>
 <p className="text-2xl font-bold">{customer_insights.demographics.churn_risk_customers}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-primary/10">
 <DollarSign className="h-5 w-5 text-primary" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Avg LTV</p>
 <p className="text-2xl font-bold">${customer_insights.metrics.avg_lifetime_value}</p>
 </div>
 </div>
 </GradientCard>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Customer Segments */}
 <Card>
 <CardHeader>
 <CardTitle>Customer Segments</CardTitle>
 <CardDescription>Distribution by purchase behavior</CardDescription>
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

 {/* Spending Tiers */}
 <Card>
 <CardHeader>
 <CardTitle>Spending Tiers</CardTitle>
 <CardDescription>Customer distribution by total spend</CardDescription>
 </CardHeader>
 <CardContent>
 {spendingTiersData.length > 0 ? (
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={spendingTiersData} layout="vertical">
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
 <Tooltip contentStyle={tooltipStyle} />
 <Bar dataKey="value" radius={[0, 4, 4, 0]}>
 {spendingTiersData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.fill} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <div className="flex items-center justify-center h-[300px] text-muted-foreground">
 No spending data available
 </div>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Customer Acquisition */}
 <Card>
 <CardHeader>
 <CardTitle>Customer Acquisition Trend</CardTitle>
 <CardDescription>New customers acquired per month</CardDescription>
 </CardHeader>
 <CardContent>
 <ResponsiveContainer width="100%" height={250}>
 <LineChart data={customer_insights.demographics.acquisition_trend}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
 <Tooltip contentStyle={tooltipStyle} />
 <Line 
 type="monotone" 
 dataKey="new_customers" 
 stroke="hsl(var(--chart-2))" 
 strokeWidth={2}
 dot={{ fill:'hsl(var(--chart-2))' }}
 />
 </LineChart>
 </ResponsiveContainer>
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
 <div key={customer.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
 {index + 1}
 </div>
 <div>
 <p className="text-sm font-medium">
 {customer.customer_name || `Customer #${customer.user_id.slice(0, 8)}`}
 </p>
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
 <div className="flex items-center justify-center h-[200px] text-muted-foreground">
 No customer data available
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* PATTERNS TAB */}
 <TabsContent value="patterns" className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-primary/10">
 <CalendarIcon className="h-5 w-5 text-primary" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">Peak Day</p>
 <p className="text-2xl font-bold">{transaction_patterns.peak_day}</p>
 </div>
 </div>
 </GradientCard>

 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-xl bg-success/10">
 <Clock className="h-5 w-5 text-success" />
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
 <Bar dataKey="transactions" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
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
 formatter={(value: number) => [`$${value.toFixed(2)}`,'Revenue']}
 />
 <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 </TabsContent>

 {/* AI INSIGHTS TAB */}
 <TabsContent value="ai" className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Brain className="h-5 w-5" />
 AI-Powered Insights
 </CardTitle>
 <CardDescription>Intelligent analysis of your business data</CardDescription>
 </CardHeader>
 <CardContent>
 {ai_insights && ai_insights.length > 0 ? (
 <div className="space-y-4">
 {ai_insights.map((insight: any, index: number) => (
 <div key={index} className="p-4 rounded-lg border bg-card hover:bg-muted transition-colors">
 <div className="flex items-start gap-4">
 <div className="p-2 rounded-lg bg-muted">
 {getInsightIcon(insight.type)}
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-semibold">{insight.title}</h4>
 <Badge variant={insight.confidence ==='high' ?'default' :'secondary'} className="text-xs">
 {insight.confidence} confidence
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground">{insight.description}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
 <p>Gathering insights from your data...</p>
 </div>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Lightbulb className="h-5 w-5" />
 Growth Opportunities
 </CardTitle>
 <CardDescription>Actionable recommendations to grow your business</CardDescription>
 </CardHeader>
 <CardContent>
 {growth_opportunities && growth_opportunities.length > 0 ? (
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
 {opportunity.potential_revenue > 0 && (
 <p className="text-xs text-success mt-2">
 Potential revenue: ${opportunity.potential_revenue.toFixed(2)}
 </p>
 )}
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
 </TabsContent>

 {/* BENCHMARK TAB */}
 <TabsContent value="benchmark" className="space-y-6">
 {/* Performance Score */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Target className="h-5 w-5" />
 Overall Performance Score
 </CardTitle>
 <CardDescription>How your business compares to industry standards</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="flex items-center justify-center">
 <ResponsiveContainer width={200} height={200}>
 <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={performanceData} startAngle={180} endAngle={0}>
 <RadialBar
 dataKey="value"
 cornerRadius={10}
 background={{ fill:'hsl(var(--muted))' }}
 />
 </RadialBarChart>
 </ResponsiveContainer>
 <div className="text-center absolute">
 <p className="text-4xl font-bold">{competitive_benchmarking.overall_performance_score}</p>
 <p className="text-sm text-muted-foreground">/100</p>
 </div>
 </div>
 <div className="text-center mt-4">
 <Badge 
 className={
 competitive_benchmarking.overall_performance_score >= 70 ?'bg-success' :
 competitive_benchmarking.overall_performance_score >= 40 ?'bg-warning' :'bg-destructive'
 }
 >
 {competitive_benchmarking.overall_performance_score >= 70 ?'Excellent' :
 competitive_benchmarking.overall_performance_score >= 40 ?'Good' :'Needs Improvement'}
 </Badge>
 </div>
 </CardContent>
 </Card>

 {/* Competitive Benchmarking */}
 <Card>
 <CardHeader>
 <CardTitle>Industry Benchmarking</CardTitle>
 <CardDescription>How you compare to pet service industry averages</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-sm text-muted-foreground mb-1">Avg Order Value</p>
 <p className="text-2xl font-bold">${competitive_benchmarking.your_avg_transaction.toFixed(2)}</p>
 <p className="text-xs text-muted-foreground">Industry: ${competitive_benchmarking.industry_avg_transaction}</p>
 <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(competitive_benchmarking.transaction_value_vs_industry)}`}>
 {getGrowthIcon(competitive_benchmarking.transaction_value_vs_industry)}
 <span className="text-sm font-medium">{competitive_benchmarking.transaction_value_vs_industry.toFixed(1)}% vs industry</span>
 </div>
 </div>
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-sm text-muted-foreground mb-1">Repeat Purchase Rate</p>
 <p className="text-2xl font-bold">{competitive_benchmarking.your_repeat_rate.toFixed(1)}%</p>
 <p className="text-xs text-muted-foreground">Industry: {competitive_benchmarking.industry_avg_repeat_rate}%</p>
 <div className={`flex items-center justify-center gap-1 mt-1 ${getGrowthColor(competitive_benchmarking.repeat_rate_vs_industry)}`}>
 {getGrowthIcon(competitive_benchmarking.repeat_rate_vs_industry)}
 <span className="text-sm font-medium">{competitive_benchmarking.repeat_rate_vs_industry > 0 ?'+' :''}{competitive_benchmarking.repeat_rate_vs_industry.toFixed(1)}pp</span>
 </div>
 </div>
 <div className="text-center p-4 rounded-lg bg-muted">
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

 {/* Summary Stats */}
 <Card>
 <CardHeader>
 <CardTitle>Business Health Summary</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-sm text-muted-foreground">Rewards Given</p>
 <p className="text-xl font-bold">{overview.total_rewards_given.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground">PawBucks</p>
 </div>
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-sm text-muted-foreground">One-time Buyers</p>
 <p className="text-xl font-bold">{customer_insights.segments.one_time_buyers}</p>
 <p className="text-xs text-muted-foreground">customers</p>
 </div>
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-sm text-muted-foreground">Repeat Buyers</p>
 <p className="text-xl font-bold">{customer_insights.segments.repeat_buyers}</p>
 <p className="text-xs text-muted-foreground">customers</p>
 </div>
 <div className="text-center p-4 rounded-lg bg-muted">
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
