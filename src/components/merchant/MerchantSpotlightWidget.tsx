import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { GradientCard } from"@/components/ui/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Button } from"@/components/ui/button";
import { Progress } from"@/components/ui/progress";
import { 
 Sparkles, Loader2, Eye, MousePointer, Users, Heart, 
 TrendingUp, DollarSign, Calendar, MapPin, Mail, Bell,
 Crown, CheckCircle, Lightbulb, ArrowUpRight, BarChart3
} from"lucide-react";
import { 
 AreaChart, Area, XAxis, YAxis, CartesianGrid, 
 Tooltip, ResponsiveContainer, BarChart, Bar
} from"recharts";

import { Formatters } from "@/utils/formatters";
const tooltipStyle = {
 backgroundColor:'hsl(var(--card))',
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px',
 padding:'8px 12px'
};

interface SpotlightDashboard {
 generated_at: string;
 merchant_name: string;
 business_type: string;
 spotlight_status: {
 active: boolean;
 activated_at: string;
 days_active: number;
 type: string;
 duration: string;
 days_remaining: number;
 };
 performance: {
 total_impressions: number;
 total_clicks: number;
 click_through_rate: number;
 new_customers: number;
 profile_views: number;
 saves_to_favorites: number;
 };
 comparison: {
 before: { period: string; revenue: number; transactions: number };
 after: { period: string; revenue: number; transactions: number };
 revenue_growth: number;
 transaction_growth: number;
 };
 placements: {
 location: string;
 status: string;
 estimated_daily_views?: number;
 estimated_reach?: number;
 position?: number;
 send_date?: string;
 }[];
 daily_trend: {
 date: string;
 impressions: number;
 clicks: number;
 conversions: number;
 }[];
 insights: {
 insight: string;
 type: string;
 icon: string;
 }[];
 optimizations: {
 suggestion: string;
 impact: string;
 action: string;
 completed: boolean;
 }[];
}

export function MerchantSpotlightWidget() {
 const { data, isLoading } = useQuery({
 queryKey: ['merchant-spotlight-dashboard'],
 queryFn: async () => {
 const { data, error } = await supabase.functions.invoke('merchant-spotlight-dashboard');
 if (error) throw error;
 return data as { has_access: boolean; dashboard?: SpotlightDashboard; message?: string };
 }
 });

 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 );
 }

 if (!data?.has_access) {
 return (
 <Card className="border-dashed">
 <CardContent className="py-12 text-center">
 <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="font-semibold mb-2">Merchant Spotlight Feature</h3>
 <p className="text-muted-foreground text-sm max-w-md mx-auto">
 {data?.message ||'This premium feature must be assigned by an admin. Get featured prominently across the platform for maximum visibility.'}
 </p>
 </CardContent>
 </Card>
 );
 }

 const dashboard = data.dashboard!;
 const { spotlight_status, performance, comparison, placements, daily_trend, insights, optimizations } = dashboard;

 const progressPercent = ((30 - spotlight_status.days_remaining) / 30) * 100;

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-2xl font-bold flex items-center gap-2">
 <Sparkles className="h-6 w-6 text-primary" />
 Merchant Spotlight
 </h2>
 <p className="text-muted-foreground">
 Your business is featured across the PawBucks platform
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Badge className="bg-gradient-to-r from-warning to-warning text-white gap-1">
 <Sparkles className="h-3 w-3" /> Featured
 </Badge>
 <Badge className="bg-gradient-to-r from-primary to-primary/60 gap-1">
 <Crown className="h-3 w-3" /> Premium
 </Badge>
 </div>
 </div>

 {/* Spotlight Status Banner */}
 <GradientCard gradient>
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-3 h-3 rounded-full bg-success animate-pulse" />
 <span className="font-semibold text-success">Spotlight Active</span>
 </div>
 <p className="text-sm text-muted-foreground">
 Activated on {new Date(spotlight_status.activated_at).toLocaleDateString()} • 
 {spotlight_status.days_active} days active
 </p>
 </div>
 <div className="min-w-[200px]">
 <div className="flex justify-between text-sm mb-1">
 <span className="text-muted-foreground">Campaign Progress</span>
 <span className="font-medium">{spotlight_status.days_remaining} days left</span>
 </div>
 <Progress value={progressPercent} className="h-2" />
 </div>
 </div>
 </GradientCard>

 {/* Performance Metrics */}
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
 <Card>
 <CardContent className="pt-4 text-center">
 <Eye className="h-5 w-5 text-info mx-auto mb-2" />
 <p className="text-2xl font-bold">{(performance.total_impressions / 1000).toFixed(1)}K</p>
 <p className="text-xs text-muted-foreground">Impressions</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 text-center">
 <MousePointer className="h-5 w-5 text-success mx-auto mb-2" />
 <p className="text-2xl font-bold">{(performance.total_clicks / 1000).toFixed(1)}K</p>
 <p className="text-xs text-muted-foreground">Clicks</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 text-center">
 <TrendingUp className="h-5 w-5 text-accent mx-auto mb-2" />
 <p className="text-2xl font-bold">{Formatters.decimal(performance.click_through_rate, 1)}%</p>
 <p className="text-xs text-muted-foreground">CTR</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 text-center">
 <Users className="h-5 w-5 text-warning mx-auto mb-2" />
 <p className="text-2xl font-bold">{performance.new_customers}</p>
 <p className="text-xs text-muted-foreground">New Customers</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 text-center">
 <BarChart3 className="h-5 w-5 text-info mx-auto mb-2" />
 <p className="text-2xl font-bold">{(performance.profile_views / 1000).toFixed(1)}K</p>
 <p className="text-xs text-muted-foreground">Profile Views</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 text-center">
 <Heart className="h-5 w-5 text-destructive mx-auto mb-2" />
 <p className="text-2xl font-bold">{performance.saves_to_favorites}</p>
 <p className="text-xs text-muted-foreground">Saves</p>
 </CardContent>
 </Card>
 </div>

 {/* Revenue Comparison */}
 <div className="grid md:grid-cols-2 gap-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Before Spotlight</CardTitle>
 <CardDescription>{comparison.before.period}</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Revenue</span>
 <span className="font-semibold">${comparison.before.revenue.toLocaleString()}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Transactions</span>
 <span className="font-semibold">{comparison.before.transactions}</span>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="border-primary bg-primary/5">
 <CardHeader className="pb-2">
 <CardTitle className="text-base flex items-center gap-2">
 After Spotlight
 {comparison.revenue_growth > 0 && (
 <Badge className="bg-success/10 text-success">
 +{comparison.revenue_growth}%
 </Badge>
 )}
 </CardTitle>
 <CardDescription>{comparison.after.period}</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Revenue</span>
 <span className="font-semibold text-success">${comparison.after.revenue.toLocaleString()}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Transactions</span>
 <span className="font-semibold text-success">{comparison.after.transactions}</span>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="placements" className="space-y-6">
 <TabsList className="grid grid-cols-4 w-full max-w-lg">
 <TabsTrigger value="placements">Placements</TabsTrigger>
 <TabsTrigger value="trends">Trends</TabsTrigger>
 <TabsTrigger value="insights">Insights</TabsTrigger>
 <TabsTrigger value="optimize">Optimize</TabsTrigger>
 </TabsList>

 {/* Placements Tab */}
 <TabsContent value="placements" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <MapPin className="h-5 w-5" />
 Active Placements
 </CardTitle>
 <CardDescription>Where your business is being featured</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {placements.map((placement, idx) => (
 <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
 <div className="flex items-center gap-4">
 <div className={`p-2 rounded-lg ${
 placement.status ==='active' ?'bg-success/10' :
 placement.status ==='featured' ?'bg-warning/10' :'bg-info/10'
 }`}>
 {placement.location.includes('Email') ? <Mail className="h-5 w-5 text-accent" /> :
 placement.location.includes('Push') ? <Bell className="h-5 w-5 text-info" /> :
 <MapPin className={`h-5 w-5 ${placement.status ==='active' ?'text-success' :'text-warning'}`} />}
 </div>
 <div>
 <p className="font-medium">{placement.location}</p>
 {placement.position && (
 <p className="text-sm text-muted-foreground">Position #{placement.position}</p>
 )}
 {placement.send_date && (
 <p className="text-sm text-muted-foreground">
 Scheduled: {new Date(placement.send_date).toLocaleDateString()}
 </p>
 )}
 </div>
 </div>
 <div className="text-right">
 <Badge variant="outline" className={
 placement.status ==='active' ?'bg-success/10 text-success' :
 placement.status ==='featured' ?'bg-warning/10 text-warning' :
'bg-info/10 text-info'
 }>
 {placement.status}
 </Badge>
 <p className="text-sm text-muted-foreground mt-1">
 {placement.estimated_daily_views 
 ? `~${placement.estimated_daily_views.toLocaleString()} daily views`
 : placement.estimated_reach 
 ? `~${placement.estimated_reach.toLocaleString()} reach`
 :''}
 </p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Trends Tab */}
 <TabsContent value="trends" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <TrendingUp className="h-5 w-5" />
 Daily Performance
 </CardTitle>
 <CardDescription>Impressions, clicks, and conversions over time</CardDescription>
 </CardHeader>
 <CardContent>
 <ResponsiveContainer width="100%" height={300}>
 <AreaChart data={daily_trend}>
 <defs>
 <linearGradient id="spotlightGradient" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
 </linearGradient>
 </defs>
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
 labelFormatter={(value) => new Date(value).toLocaleDateString()}
 />
 <Area 
 type="monotone" 
 dataKey="impressions" 
 stroke="hsl(var(--primary))" 
 fill="url(#spotlightGradient)"
 strokeWidth={2}
 name="Impressions"
 />
 <Area 
 type="monotone" 
 dataKey="clicks" 
 stroke="hsl(142, 76%, 36%)" 
 fill="none"
 strokeWidth={2}
 name="Clicks"
 />
 </AreaChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Insights Tab */}
 <TabsContent value="insights" className="space-y-4">
 <div className="grid gap-4">
 {insights.map((insight, idx) => (
 <Card key={idx} className={
 insight.type ==='success' ?'border-success/30 bg-success/5' :
 insight.type ==='tip' ?'border-info/30 bg-info/5' :
'border-border'
 }>
 <CardContent className="pt-4">
 <div className="flex items-start gap-3">
 <div className={`p-2 rounded-lg ${
 insight.type ==='success' ?'bg-success/10' :
 insight.type ==='tip' ?'bg-info/10' :'bg-muted'
 }`}>
 {insight.type ==='success' ? <CheckCircle className="h-5 w-5 text-success" /> :
 insight.type ==='tip' ? <Lightbulb className="h-5 w-5 text-info" /> :
 <TrendingUp className="h-5 w-5 text-muted-foreground" />}
 </div>
 <p className="text-sm leading-relaxed">{insight.insight}</p>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </TabsContent>

 {/* Optimize Tab */}
 <TabsContent value="optimize" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Lightbulb className="h-5 w-5" />
 Optimization Checklist
 </CardTitle>
 <CardDescription>Maximize your spotlight impact</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {optimizations.map((opt, idx) => (
 <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
 <div className="flex items-center gap-4">
 <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
 opt.completed ?'bg-success text-white' :'border-2 border-muted'
 }`}>
 {opt.completed && <CheckCircle className="h-4 w-4" />}
 </div>
 <div>
 <p className={`font-medium ${opt.completed ?'line-through text-muted-foreground' :''}`}>
 {opt.suggestion}
 </p>
 <Badge variant="outline" className={
 opt.impact ==='High' ?'bg-destructive/10 text-destructive mt-1' :'bg-warning/10 text-warning mt-1'
 }>
 {opt.impact} Impact
 </Badge>
 </div>
 </div>
 {!opt.completed && (
 <Button variant="outline" size="sm" className="gap-1">
 {opt.action}
 <ArrowUpRight className="h-3 w-3" />
 </Button>
 )}
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
