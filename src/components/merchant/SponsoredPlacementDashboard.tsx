import { useState } from"react";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Progress } from"@/components/ui/progress";
import { Skeleton } from"@/components/ui/skeleton";
import { Eye, MousePointerClick, ShoppingCart, TrendingUp, Target, Award, Lightbulb, RefreshCw, Download, Calendar, MapPin, Search, LayoutGrid, Map, BarChart3, Users, Clock, Smartphone, Monitor, Tablet, Trophy, AlertTriangle, CheckCircle, ArrowUp, ArrowDown } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import {
 LineChart,
 Line,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 ResponsiveContainer,
 AreaChart,
 Area,
 BarChart,
 Bar,
 PieChart,
 Pie,
 Cell,
 RadialBarChart,
 RadialBar,
 Legend,
} from"recharts";
import { format, subDays } from"date-fns";
import { toast } from"sonner";

import { Formatters } from "@/utils/formatters";
interface SponsoredPlacementDashboardProps {
 merchantId: string;
 serviceType?:'sponsored' |'premium-ad';
}

const COLORS = ["hsl(var(--primary))","hsl(var(--chart-2))","hsl(var(--chart-3))","hsl(var(--chart-4))"];

const datePresets = [
 { label:"7 days", days: 7 },
 { label:"30 days", days: 30 },
 { label:"90 days", days: 90 },
];

export function SponsoredPlacementDashboard({ merchantId, serviceType ='sponsored' }: SponsoredPlacementDashboardProps) {
 const dashboardTitle = serviceType ==='premium-ad' ?'Premium Ad Placement Performance' :'Sponsored Placement Performance';
 const [dateRange, setDateRange] = useState({ days: 30 });

 const startDate = subDays(new Date(), dateRange.days).toISOString();
 const endDate = new Date().toISOString();

 // Fetch main analytics
 const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
 queryKey: ["sponsored-analytics", merchantId, dateRange.days],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke("sponsored-placement-analytics", {
 body: {
 action:"getAnalytics",
 merchantId,
 dateRange: { start: startDate, end: endDate },
 },
 });
 if (error) throw error;
 return data;
 },
 });

 // Fetch competitor benchmark
 const { data: benchmark, isLoading: benchmarkLoading } = useQuery({
 queryKey: ["sponsored-benchmark", merchantId],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke("sponsored-placement-analytics", {
 body: {
 action:"getCompetitorBenchmark",
 merchantId,
 },
 });
 if (error) throw error;
 return data;
 },
 });

 // Fetch AI recommendations
 const { data: aiData, isLoading: aiLoading } = useQuery({
 queryKey: ["sponsored-ai", merchantId, dateRange.days],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke("sponsored-placement-analytics", {
 body: {
 action:"getAIRecommendations",
 merchantId,
 dateRange: { start: startDate, end: endDate },
 },
 });
 if (error) throw error;
 return data;
 },
 });

 const handleRefresh = () => {
 refetchAnalytics();
 toast.success("Dashboard refreshed");
 };

 const handleExport = (format:"pdf" |"csv") => {
 toast.success(`Exporting ${format.toUpperCase()} report...`);
 // Export logic would be implemented here
 };

 const isLoading = analyticsLoading || benchmarkLoading || aiLoading;

 if (isLoading) {
 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <Skeleton className="h-8 w-64" />
 <Skeleton className="h-10 w-32" />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 {[...Array(4)].map((_, i) => (
 <Skeleton key={i} className="h-32" />
 ))}
 </div>
 <Skeleton className="h-96" />
 </div>
 );
 }

 const overview = analytics?.overview || {
 totalImpressions: 0,
 totalClicks: 0,
 totalConversions: 0,
 ctr: 0,
 conversionRate: 0,
 uniqueViewers: 0,
 avgPosition: 1,
 revenue: 0,
 roi: 0,
 };

 const sourceBreakdown = analytics?.sourceBreakdown || {};
 const dailyTrends = analytics?.dailyTrends || [];
 const subscription = analytics?.subscription;
 const deviceBreakdown = analytics?.deviceBreakdown || {};

 // Format source data for charts
 const sourceChartData = Object.entries(sourceBreakdown).map(([source, data]: [string, any]) => ({
 name: source.charAt(0).toUpperCase() + source.slice(1),
 impressions: data.impressions,
 clicks: data.clicks,
 conversions: data.conversions,
 ctr: data.impressions > 0 ? Formatters.decimal(((data.clicks / data.impressions) * 100), 1) : 0,
 }));

 // Format device data for pie chart
 const deviceChartData = Object.entries(deviceBreakdown).map(([device, count]: [string, any]) => ({
 name: device.charAt(0).toUpperCase() + device.slice(1),
 value: count,
 }));

 const getDeviceIcon = (device: string) => {
 switch (device.toLowerCase()) {
 case"mobile": return Smartphone;
 case"desktop": return Monitor;
 case"tablet": return Tablet;
 default: return Monitor;
 }
 };

 const getRecommendationIcon = (type: string) => {
 switch (type) {
 case"warning": return AlertTriangle;
 case"opportunity": return TrendingUp;
 case"action": return Target;
 case"insight": return Lightbulb;
 default: return CheckCircle;
 }
 };

 const getRecommendationColor = (type: string) => {
 switch (type) {
 case"warning": return"text-warning";
 case"opportunity": return"text-success";
 case"action": return"text-info";
 case"insight": return"text-accent";
 default: return"text-muted-foreground";
 }
 };

 const getPriorityBadge = (priority: string) => {
 switch (priority) {
 case"high": return <Badge variant="destructive">High Priority</Badge>;
 case"medium": return <Badge variant="secondary">Medium</Badge>;
 case"low": return <Badge variant="outline">Low</Badge>;
 default: return null;
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold flex items-center gap-2">
 <Sparkles className="w-6 h-6 text-primary" />
 {dashboardTitle}
 </h2>
 <p className="text-muted-foreground">
 Track your visibility, engagement, and ROI across all discovery channels
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Button variant="outline" size="sm" onClick={handleRefresh}>
 <RefreshCw className="w-4 h-4 mr-1" />
 Refresh
 </Button>
 <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
 <Download className="w-4 h-4 mr-1" />
 Export
 </Button>
 </div>
 </div>

 {/* Date Range Selector */}
 <div className="flex items-center gap-2">
 <Calendar className="w-4 h-4 text-muted-foreground" />
 {datePresets.map((preset) => (
 <Button
 key={preset.days}
 variant={dateRange.days === preset.days ?"default" :"outline"}
 size="sm"
 onClick={() => setDateRange({ days: preset.days })}
 >
 {preset.label}
 </Button>
 ))}
 </div>

 {/* Subscription Status */}
 {subscription && (
 <Card className="border-primary/30 bg-primary/5">
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="p-2 rounded-full bg-primary/10">
 <Award className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="font-medium">Sponsored Placement Active</p>
 <p className="text-sm text-muted-foreground">
 {subscription.daysRemaining !== null
 ? `${subscription.daysRemaining} days remaining`
 :"Active subscription"}
 </p>
 </div>
 </div>
 <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
 </div>
 {subscription.daysRemaining !== null && subscription.daysRemaining <= 7 && (
 <div className="mt-3 p-2 bg-warning/10 rounded-lg border border-warning/20">
 <p className="text-sm text-warning flex items-center gap-2">
 <AlertTriangle className="w-4 h-4" />
 Your sponsored placement expires soon. Renew to maintain visibility.
 </p>
 </div>
 )}
 </CardContent>
 </Card>
 )}

 <Tabs defaultValue="overview" className="space-y-6">
 <TabsList className="flex w-full overflow-x-auto no-scrollbar gap-1 h-auto flex-wrap sm:flex-nowrap sm:grid sm:grid-cols-5 sm:max-w-2xl">
 <TabsTrigger value="overview" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2">Overview</TabsTrigger>
 <TabsTrigger value="sources" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2">Traffic Sources</TabsTrigger>
 <TabsTrigger value="roi" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2">ROI & Revenue</TabsTrigger>
 <TabsTrigger value="benchmark" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2">Benchmark</TabsTrigger>
 <TabsTrigger value="recommendations" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2">AI Insights</TabsTrigger>
 </TabsList>

 {/* Overview Tab */}
 <TabsContent value="overview" className="space-y-6">
 {/* Key Metrics */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Total Impressions</p>
 <p className="text-3xl font-bold">{overview.totalImpressions.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground mt-1">
 {overview.uniqueViewers.toLocaleString()} unique viewers
 </p>
 </div>
 <div className="p-3 rounded-full bg-info/10">
 <Eye className="w-6 h-6 text-info" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Total Clicks</p>
 <p className="text-3xl font-bold">{overview.totalClicks.toLocaleString()}</p>
 <p className="text-xs text-success mt-1 flex items-center gap-1">
 <ArrowUp className="w-3 h-3" />
 {overview.ctr}% CTR
 </p>
 </div>
 <div className="p-3 rounded-full bg-success/10">
 <MousePointerClick className="w-6 h-6 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Conversions</p>
 <p className="text-3xl font-bold">{overview.totalConversions.toLocaleString()}</p>
 <p className="text-xs text-accent mt-1 flex items-center gap-1">
 <ArrowUp className="w-3 h-3" />
 {overview.conversionRate}% rate
 </p>
 </div>
 <div className="p-3 rounded-full bg-accent/10">
 <ShoppingCart className="w-6 h-6 text-accent" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Avg Position</p>
 <p className="text-3xl font-bold">#{overview.avgPosition}</p>
 <p className="text-xs text-muted-foreground mt-1">in search results</p>
 </div>
 <div className="p-3 rounded-full bg-warning/10">
 <Trophy className="w-6 h-6 text-warning" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Performance Trend */}
 <Card>
 <CardHeader>
 <CardTitle>Performance Trend</CardTitle>
 <CardDescription>Daily impressions, clicks, and conversions over time</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-80">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={dailyTrends}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
 <XAxis
 dataKey="date"
 tickFormatter={(value) => format(new Date(value),"MMM d")}
 className="text-xs"
 />
 <YAxis className="text-xs" />
 <Tooltip
 content={({ active, payload, label }) => {
 if (!active || !payload) return null;
 return (
 <div className="bg-popover border rounded-lg p-3 shadow-lg">
 <p className="font-medium mb-2">{format(new Date(label),"MMM d, yyyy")}</p>
 {payload.map((entry: any, index: number) => (
 <p key={index} className="text-sm" style={{ color: entry.color }}>
 {entry.name}: {entry.value.toLocaleString()}
 </p>
 ))}
 </div>
 );
 }}
 />
 <Area
 type="monotone"
 dataKey="impressions"
 name="Impressions"
 stroke="hsl(var(--primary))"
 fill="hsl(var(--primary))"
 fillOpacity={0.2}
 />
 <Area
 type="monotone"
 dataKey="clicks"
 name="Clicks"
 stroke="hsl(var(--chart-2))"
 fill="hsl(var(--chart-2))"
 fillOpacity={0.2}
 />
 <Area
 type="monotone"
 dataKey="conversions"
 name="Conversions"
 stroke="hsl(var(--chart-3))"
 fill="hsl(var(--chart-3))"
 fillOpacity={0.2}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>

 {/* Device Breakdown */}
 <Card>
 <CardHeader>
 <CardTitle>Device Breakdown</CardTitle>
 <CardDescription>Where your visitors are coming from</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={deviceChartData}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={80}
 paddingAngle={5}
 dataKey="value"
 >
 {deviceChartData.map((_, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <Tooltip />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 </div>
 <div className="space-y-4">
 {deviceChartData.map((device, index) => {
 const Icon = getDeviceIcon(device.name);
 const total = deviceChartData.reduce((sum, d) => sum + d.value, 0);
 const percentage = total > 0 ? Formatters.decimal(((device.value / total) * 100), 1) : 0;
 return (
 <div key={device.name} className="flex items-center gap-4">
 <div
 className="p-2 rounded-lg"
 style={{ backgroundColor: `${COLORS[index % COLORS.length]}20` }}
 >
 <Icon className="w-5 h-5" style={{ color: COLORS[index % COLORS.length] }} />
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between mb-1">
 <span className="font-medium">{device.name}</span>
 <span className="text-sm text-muted-foreground">
 {device.value.toLocaleString()} ({percentage}%)
 </span>
 </div>
 <Progress value={Number(percentage)} className="h-2" />
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Traffic Sources Tab */}
 <TabsContent value="sources" className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {[
 { key:"discover", icon: LayoutGrid, label:"Discover Page", color:"hsl(var(--primary))" },
 { key:"directory", icon: Search, label:"Directory", color:"hsl(var(--chart-2))" },
 { key:"map", icon: Map, label:"Map View", color:"hsl(var(--chart-3))" },
 { key:"search", icon: Search, label:"Search", color:"hsl(var(--chart-4))" },
 ].map((source) => {
 const data = sourceBreakdown[source.key] || { impressions: 0, clicks: 0, conversions: 0 };
 const Icon = source.icon;
 return (
 <Card key={source.key}>
 <CardContent className="p-6">
 <div className="flex items-center gap-3 mb-4">
 <div className="p-2 rounded-lg" style={{ backgroundColor: `${source.color}20` }}>
 <Icon className="w-5 h-5" style={{ color: source.color }} />
 </div>
 <h3 className="font-semibold">{source.label}</h3>
 </div>
 <div className="space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Impressions</span>
 <span className="font-medium">{data.impressions.toLocaleString()}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Clicks</span>
 <span className="font-medium">{data.clicks.toLocaleString()}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">Conversions</span>
 <span className="font-medium">{data.conversions.toLocaleString()}</span>
 </div>
 <div className="flex justify-between text-sm pt-2 border-t">
 <span className="text-muted-foreground">CTR</span>
 <span className="font-medium text-success">
 {data.impressions > 0
 ? Formatters.decimal(((data.clicks / data.impressions) * 100), 1)
 : 0}
 %
 </span>
 </div>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>

 {/* Source Comparison Chart */}
 <Card>
 <CardHeader>
 <CardTitle>Source Performance Comparison</CardTitle>
 <CardDescription>Compare engagement across different discovery channels</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-80">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={sourceChartData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
 <XAxis dataKey="name" className="text-xs" />
 <YAxis className="text-xs" />
 <Tooltip />
 <Legend />
 <Bar dataKey="impressions" name="Impressions" fill="hsl(var(--primary))" />
 <Bar dataKey="clicks" name="Clicks" fill="hsl(var(--chart-2))" />
 <Bar dataKey="conversions" name="Conversions" fill="hsl(var(--chart-3))" />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* ROI Tab */}
 <TabsContent value="roi" className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Total Revenue</p>
 <p className="text-3xl font-bold">${overview.revenue.toLocaleString()}</p>
 <p className="text-xs text-muted-foreground mt-1">from sponsored placement</p>
 </div>
 <div className="p-3 rounded-full bg-success/10">
 <TrendingUp className="w-6 h-6 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Investment</p>
 <p className="text-3xl font-bold">${subscription?.amountPaid?.toLocaleString() || 0}</p>
 <p className="text-xs text-muted-foreground mt-1">sponsored placement cost</p>
 </div>
 <div className="p-3 rounded-full bg-info/10">
 <Target className="w-6 h-6 text-info" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className={overview.roi >= 0 ?"border-success/30" :"border-destructive/30"}>
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-muted-foreground">Return on Investment</p>
 <p className={`text-3xl font-bold ${overview.roi >= 0 ?"text-success" :"text-destructive"}`}>
 {overview.roi >= 0 ?"+" :""}
 {Formatters.number(Math.round(overview.roi))}%
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 {overview.roi >= 0 ?"profit" :"loss"} on investment
 </p>
 </div>
 <div className={`p-3 rounded-full ${overview.roi >= 0 ?"bg-success/10" :"bg-destructive/10"}`}>
 {overview.roi >= 0 ? (
 <ArrowUp className={`w-6 h-6 ${overview.roi >= 0 ?"text-success" :"text-destructive"}`} />
 ) : (
 <ArrowDown className="w-6 h-6 text-destructive" />
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Revenue Calculator */}
 <Card>
 <CardHeader>
 <CardTitle>ROI Calculator</CardTitle>
 <CardDescription>Understand the value of your sponsored placement</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-4">
 <div className="flex justify-between p-3 bg-muted rounded-lg">
 <span>Impressions Value</span>
 <span className="font-medium">
 ~{Formatters.currency((overview.totalImpressions * 0.01))}
 </span>
 </div>
 <div className="flex justify-between p-3 bg-muted rounded-lg">
 <span>Click Value</span>
 <span className="font-medium">
 ~{Formatters.currency((overview.totalClicks * 0.50))}
 </span>
 </div>
 <div className="flex justify-between p-3 bg-muted rounded-lg">
 <span>Conversion Value</span>
 <span className="font-medium">
 ~{Formatters.currency((overview.totalConversions * 25))}
 </span>
 </div>
 <div className="flex justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
 <span className="font-semibold">Total Estimated Value</span>
 <span className="font-bold text-primary">
 ~{Formatters.currency((
 overview.totalImpressions * 0.01 +
 overview.totalClicks * 0.50 +
 overview.totalConversions * 25
 ))}
 </span>
 </div>
 </div>
 <div className="flex items-center justify-center">
 <div className="text-center">
 <div className="relative inline-flex items-center justify-center">
 <svg className="w-32 h-32">
 <circle
 className="stroke-muted"
 strokeWidth="8"
 fill="transparent"
 r="56"
 cx="64"
 cy="64"
 />
 <circle
 className="stroke-primary"
 strokeWidth="8"
 strokeLinecap="round"
 fill="transparent"
 r="56"
 cx="64"
 cy="64"
 strokeDasharray={`${Math.min(100, Math.max(0, overview.roi + 100)) * 3.52} 352`}
 transform="rotate(-90 64 64)"
 />
 </svg>
 <span className="absolute text-2xl font-bold">
 {Formatters.number(Math.round(Math.min(100, Math.max(0, overview.roi + 100))))}%
 </span>
 </div>
 <p className="text-sm text-muted-foreground mt-2">ROI Score</p>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Benchmark Tab */}
 <TabsContent value="benchmark" className="space-y-6">
 {benchmark && (
 <>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card className="border-primary/30">
 <CardContent className="p-6">
 <div className="text-center">
 <p className="text-sm text-muted-foreground mb-2">Your Ranking</p>
 <p className="text-4xl font-bold text-primary">#{benchmark.ranking.position}</p>
 <p className="text-sm text-muted-foreground mt-1">
 of {benchmark.ranking.totalCompetitors} {benchmark.businessType.replace(/_/g,"")}s
 </p>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="p-6">
 <div className="text-center">
 <p className="text-sm text-muted-foreground mb-2">Percentile</p>
 <p className="text-4xl font-bold">{benchmark.ranking.percentile}%</p>
 <p className="text-sm text-muted-foreground mt-1">top performer</p>
 </div>
 </CardContent>
 </Card>

 <Card className={benchmark.performanceScore >= 70 ?"border-success/30" :"border-warning/30"}>
 <CardContent className="p-6">
 <div className="text-center">
 <p className="text-sm text-muted-foreground mb-2">Performance Score</p>
 <p
 className={`text-4xl font-bold ${
 benchmark.performanceScore >= 70 ?"text-success" :"text-warning"
 }`}
 >
 {benchmark.performanceScore}
 </p>
 <p className="text-sm text-muted-foreground mt-1">out of 100</p>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Comparison Chart */}
 <Card>
 <CardHeader>
 <CardTitle>You vs Industry Average</CardTitle>
 <CardDescription>Compare your performance against competitors in your category</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-6">
 {[
 {
 label:"Impressions",
 yours: benchmark.yourMetrics.impressions,
 average: benchmark.industryAverages.impressions,
 },
 {
 label:"Clicks",
 yours: benchmark.yourMetrics.clicks,
 average: benchmark.industryAverages.clicks,
 },
 {
 label:"Conversions",
 yours: benchmark.yourMetrics.conversions,
 average: benchmark.industryAverages.conversions,
 },
 {
 label:"CTR (%)",
 yours: benchmark.yourMetrics.ctr,
 average: benchmark.industryAverages.ctr,
 },
 {
 label:"Conversion Rate (%)",
 yours: benchmark.yourMetrics.conversionRate,
 average: benchmark.industryAverages.conversionRate,
 },
 ].map((metric) => {
 const isAboveAverage = metric.yours >= metric.average;
 const percentage =
 metric.average > 0 ? Math.min(100, (metric.yours / metric.average) * 50) : 50;
 return (
 <div key={metric.label}>
 <div className="flex items-center justify-between mb-2">
 <span className="font-medium">{metric.label}</span>
 <div className="flex items-center gap-4 text-sm">
 <span className="text-primary font-semibold">
 You: {typeof metric.yours ==="number" ? metric.yours.toLocaleString() : metric.yours}
 </span>
 <span className="text-muted-foreground">
 Avg:{""}
 {typeof metric.average ==="number"
 ? metric.average.toLocaleString()
 : metric.average}
 </span>
 {isAboveAverage ? (
 <Badge className="bg-success/10 text-success border-success/20">
 <ArrowUp className="w-3 h-3 mr-1" />
 Above
 </Badge>
 ) : (
 <Badge className="bg-destructive/10 text-destructive border-destructive/20">
 <ArrowDown className="w-3 h-3 mr-1" />
 Below
 </Badge>
 )}
 </div>
 </div>
 <div className="relative h-3 bg-muted rounded-full overflow-hidden">
 <div
 className="absolute h-full bg-primary rounded-full transition-all"
 style={{ width: `${percentage}%` }}
 />
 <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-muted-foreground/50" />
 </div>
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>
 </>
 )}
 </TabsContent>

 {/* AI Recommendations Tab */}
 <TabsContent value="recommendations" className="space-y-6">
 {aiData && (
 <>
 {/* Health Score */}
 <Card className="border-primary/30">
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold mb-1">Placement Health Score</h3>
 <p className="text-sm text-muted-foreground">
 Based on profile completeness, engagement, and optimization
 </p>
 </div>
 <div className="text-center">
 <div
 className={`text-4xl font-bold ${
 aiData.healthScore >= 70
 ?"text-success"
 : aiData.healthScore >= 40
 ?"text-warning"
 :"text-destructive"
 }`}
 >
 {aiData.healthScore}
 </div>
 <p className="text-xs text-muted-foreground">out of 100</p>
 </div>
 </div>
 <Progress
 value={aiData.healthScore}
 className={`mt-4 h-3 ${
 aiData.healthScore >= 70
 ?"[&>div]:bg-success"
 : aiData.healthScore >= 40
 ?"[&>div]:bg-warning"
 :"[&>div]:bg-destructive"
 }`}
 />
 </CardContent>
 </Card>

 {/* Predictions */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Sparkles className="w-5 h-5 text-primary" />
 Next Month Predictions
 </CardTitle>
 <CardDescription>AI-powered forecasts based on your current trajectory</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="p-4 bg-muted rounded-lg text-center">
 <p className="text-sm text-muted-foreground mb-1">Projected Impressions</p>
 <p className="text-2xl font-bold">
 {aiData.predictions.nextMonth.impressions.toLocaleString()}
 </p>
 <Badge className="mt-2 bg-success/10 text-success border-success/20">
 +{aiData.predictions.growthRate}% growth
 </Badge>
 </div>
 <div className="p-4 bg-muted rounded-lg text-center">
 <p className="text-sm text-muted-foreground mb-1">Projected Clicks</p>
 <p className="text-2xl font-bold">
 {aiData.predictions.nextMonth.clicks.toLocaleString()}
 </p>
 </div>
 <div className="p-4 bg-muted rounded-lg text-center">
 <p className="text-sm text-muted-foreground mb-1">Projected Conversions</p>
 <p className="text-2xl font-bold">
 {aiData.predictions.nextMonth.conversions.toLocaleString()}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Recommendations List */}
 <Card>
 <CardHeader>
 <CardTitle>AI-Powered Recommendations</CardTitle>
 <CardDescription>Personalized insights to improve your sponsored placement performance</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {aiData.recommendations.map((rec: any, index: number) => {
 const Icon = getRecommendationIcon(rec.type);
 return (
 <div
 key={index}
 className="p-4 border rounded-lg hover:bg-muted transition-colors"
 >
 <div className="flex items-start gap-4">
 <div className={`p-2 rounded-lg bg-muted ${getRecommendationColor(rec.type)}`}>
 <Icon className="w-5 h-5" />
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between mb-1">
 <h4 className="font-semibold">{rec.title}</h4>
 {getPriorityBadge(rec.priority)}
 </div>
 <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
 <p className="text-xs text-primary font-medium">{rec.potentialImpact}</p>
 </div>
 </div>
 </div>
 );
 })}
 {aiData.recommendations.length === 0 && (
 <div className="text-center py-8">
 <CheckCircle className="w-12 h-12 mx-auto text-success mb-3" />
 <p className="font-medium">Great job!</p>
 <p className="text-sm text-muted-foreground">
 Your sponsored placement is optimized. Keep up the good work!
 </p>
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </>
 )}
 </TabsContent>
 </Tabs>
 </div>
 );
}