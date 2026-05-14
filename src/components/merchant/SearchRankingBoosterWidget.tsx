import { useState } from"react";
import { useQuery, useQueryClient } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Progress } from"@/components/ui/progress";
import { GradientCard } from"@/components/ui/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { AlertCircle, BarChart3, Brain, CheckCircle2, FileText, Lightbulb, Loader2, MapPin, Plus, Rocket, Search, Star, Tag, Target, TrendingUp, Zap } from "lucide-react";
import { SERVICE_NAMES, merchantHasActiveService } from"@/services/api/merchantServices.service";
import { Link } from"react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from"recharts";
import { toast } from"sonner";

export function SearchRankingBoosterWidget() {
 const [addingKeyword, setAddingKeyword] = useState<string | null>(null);
 const queryClient = useQueryClient();

 const { data: merchantData } = useQuery({
 queryKey: ['merchant-for-search-booster'],
 queryFn: async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return null;
 const { data } = await supabase.from('merchants').select('id').eq('user_id', user.id).single();
 return data;
 }
 });

 const { data: analyticsData, isLoading } = useQuery({
 queryKey: ['search-ranking-analytics', merchantData?.id],
 queryFn: async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !merchantData?.id) return null;

 const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-ranking-analytics`, {
 method:'POST',
 headers: {
'Authorization': `Bearer ${session.access_token}`,
'Content-Type':'application/json',
 },
 body: JSON.stringify({ action:'getAnalytics', merchantId: merchantData.id }),
 });
 return response.json();
 },
 enabled: !!merchantData?.id,
 });

 const { data: keywordData } = useQuery({
 queryKey: ['search-ranking-keywords', merchantData?.id],
 queryFn: async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !merchantData?.id) return null;

 const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-ranking-analytics`, {
 method:'POST',
 headers: {
'Authorization': `Bearer ${session.access_token}`,
'Content-Type':'application/json',
 },
 body: JSON.stringify({ action:'getKeywordInsights', merchantId: merchantData.id }),
 });
 return response.json();
 },
 enabled: !!merchantData?.id,
 });

 const { data: aiData } = useQuery({
 queryKey: ['search-ranking-ai', merchantData?.id],
 queryFn: async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !merchantData?.id) return null;

 const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-ranking-analytics`, {
 method:'POST',
 headers: {
'Authorization': `Bearer ${session.access_token}`,
'Content-Type':'application/json',
 },
 body: JSON.stringify({ action:'getAIRecommendations', merchantId: merchantData.id }),
 });
 return response.json();
 },
 enabled: !!merchantData?.id,
 });

 const handleAddKeyword = async (keyword: string) => {
 try {
 setAddingKeyword(keyword);
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !merchantData?.id) return;

 const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-ranking-analytics`, {
 method:'POST',
 headers: {
'Authorization': `Bearer ${session.access_token}`,
'Content-Type':'application/json',
 },
 body: JSON.stringify({ action:'addKeyword', merchantId: merchantData.id, keyword }),
 });
 const result = await response.json();
 if (result.error) throw new Error(result.error);
 
 toast.success(`Keyword"${keyword}" added successfully!`);
 queryClient.invalidateQueries({ queryKey: ['search-ranking-keywords'] });
 } catch (error: any) {
 toast.error(error.message ||'Failed to add keyword');
 } finally {
 setAddingKeyword(null);
 }
 };

 const handleRemoveKeyword = async (keyword: string) => {
 try {
 setAddingKeyword(keyword);
 const { data: { session } } = await supabase.auth.getSession();
 if (!session || !merchantData?.id) return;

 const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-ranking-analytics`, {
 method:'POST',
 headers: {
'Authorization': `Bearer ${session.access_token}`,
'Content-Type':'application/json',
 },
 body: JSON.stringify({ action:'removeKeyword', merchantId: merchantData.id, keyword }),
 });
 const result = await response.json();
 if (result.error) throw new Error(result.error);
 
 toast.success(`Keyword"${keyword}" removed`);
 queryClient.invalidateQueries({ queryKey: ['search-ranking-keywords'] });
 } catch (error: any) {
 toast.error(error.message ||'Failed to remove keyword');
 } finally {
 setAddingKeyword(null);
 }
 };

 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 );
 }

 if (!analyticsData?.hasBooster) {
 return (
 <Card className="border-dashed">
 <CardContent className="py-12 text-center">
 <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
 <h3 className="font-semibold mb-2">Search Ranking Booster</h3>
 <p className="text-muted-foreground text-sm mb-4">
 Boost your search ranking to appear higher in results. Includes keyword optimization, 
 category boost, and local search priority.
 </p>
 <Button asChild><Link to="/merchant/market">Get Search Ranking Booster</Link></Button>
 </CardContent>
 </Card>
 );
 }

 const { metrics, categoryMetrics, topSearchTerms, dailyTrends, sourceBreakdown } = analyticsData;
 const healthScore = aiData?.healthScore || 0;

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold flex items-center gap-2">
 <Rocket className="h-6 w-6 text-primary" aria-hidden="true" />
 Search Ranking Booster
 </h2>
 <p className="text-muted-foreground">Visibility enhanced by {analyticsData.visibilityIncrease}%</p>
 </div>
 <Badge className="bg-gradient-to-r from-success to-success text-white gap-1">
 <Zap className="h-3 w-3" aria-hidden="true" /> Boost Active
 </Badge>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-primary/10"><TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" /></div>
 <div>
 <p className="text-sm text-muted-foreground">Boost Multiplier</p>
 <p className="text-2xl font-bold">{analyticsData.boostMultiplier}x</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-success/10"><Target className="h-5 w-5 text-success" aria-hidden="true" /></div>
 <div>
 <p className="text-sm text-muted-foreground">Avg Position</p>
 <p className="text-2xl font-bold">#{metrics.avgPosition ||'-'}</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-info/10"><Search className="h-5 w-5 text-info" /></div>
 <div>
 <p className="text-sm text-muted-foreground">Impressions</p>
 <p className="text-2xl font-bold">{metrics.impressions}</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-accent/10"><Star className="h-5 w-5 text-accent" aria-hidden="true" /></div>
 <div>
 <p className="text-sm text-muted-foreground">CTR</p>
 <p className="text-2xl font-bold">{metrics.ctr}%</p>
 </div>
 </div>
 </GradientCard>
 </div>

 <Tabs defaultValue="overview" className="space-y-4">
 <TabsList className="grid w-full grid-cols-5">
 <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1" aria-hidden="true" /> Overview</TabsTrigger>
 <TabsTrigger value="keywords"><Tag className="h-4 w-4 mr-1" aria-hidden="true" /> Keywords</TabsTrigger>
 <TabsTrigger value="sources"><MapPin className="h-4 w-4 mr-1" aria-hidden="true" /> Sources</TabsTrigger>
 <TabsTrigger value="ai"><Brain className="h-4 w-4 mr-1" aria-hidden="true" /> AI Insights</TabsTrigger>
 <TabsTrigger value="report"><FileText className="h-4 w-4 mr-1" aria-hidden="true" /> Report</TabsTrigger>
 </TabsList>

 <TabsContent value="overview" className="space-y-4">
 <div className="grid md:grid-cols-2 gap-4">
 <Card>
 <CardHeader><CardTitle>Performance Trend</CardTitle></CardHeader>
 <CardContent className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={dailyTrends}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="date" fontSize={12} />
 <YAxis fontSize={12} />
 <Tooltip />
 <Line type="monotone" dataKey="impressions" stroke="hsl(var(--chart-6))" strokeWidth={2} />
 <Line type="monotone" dataKey="clicks" stroke="hsl(var(--chart-4))" strokeWidth={2} />
 </LineChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 <Card>
 <CardHeader><CardTitle>Category & Local Metrics</CardTitle></CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <div className="flex justify-between text-sm"><span>Category Match Rate</span><span className="font-medium">{categoryMetrics.categoryMatchRate}%</span></div>
 <Progress value={categoryMetrics.categoryMatchRate} />
 </div>
 <div className="space-y-2">
 <div className="flex justify-between text-sm"><span>Local Search Rate</span><span className="font-medium">{categoryMetrics.localMatchRate}%</span></div>
 <Progress value={categoryMetrics.localMatchRate} />
 </div>
 <div className="grid grid-cols-2 gap-4 pt-4">
 <div className="text-center p-3 rounded-lg bg-muted">
 <p className="text-2xl font-bold">{metrics.clicks}</p>
 <p className="text-xs text-muted-foreground">Total Clicks</p>
 </div>
 <div className="text-center p-3 rounded-lg bg-muted">
 <p className="text-2xl font-bold">{metrics.conversions}</p>
 <p className="text-xs text-muted-foreground">Conversions</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </TabsContent>

 <TabsContent value="keywords" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-warning" aria-hidden="true" /> Keyword Recommendations</CardTitle>
 <CardDescription>Implement these keywords to improve ranking</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 {keywordData?.recommendations?.slice(0, 8).map((kw: any, idx: number) => (
 <div key={idx} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted">
 <div className="flex items-center gap-3">
 {kw.implemented ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-warning" />}
 <div>
 <p className="font-medium">{kw.keyword}</p>
 <p className="text-xs text-muted-foreground">Relevance: {kw.relevance}% • Competition: {kw.competition}</p>
 </div>
 </div>
 {kw.implemented ? (
 <Badge 
 variant="default" 
 className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors gap-1"
 onClick={() => handleRemoveKeyword(kw.keyword)}
 >
 {addingKeyword === kw.keyword ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
 Active
 </Badge>
 ) : (
 <Badge 
 variant="secondary" 
 className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors gap-1"
 onClick={() => handleAddKeyword(kw.keyword)}
 >
 {addingKeyword === kw.keyword ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
 Add
 </Badge>
 )}
 </div>
 ))}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="sources">
 <Card>
 <CardHeader><CardTitle>Traffic Sources</CardTitle></CardHeader>
 <CardContent className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={[
 { name:'Discover', value: sourceBreakdown.discover },
 { name:'Directory', value: sourceBreakdown.directory },
 { name:'Map', value: sourceBreakdown.map },
 { name:'Search', value: sourceBreakdown.search },
 ]}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="name" fontSize={12} />
 <YAxis fontSize={12} />
 <Tooltip />
 <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="ai" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-accent" aria-hidden="true" /> AI Recommendations</CardTitle>
 <CardDescription>Health Score: {healthScore}/100</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <Progress value={healthScore} className="h-3" />
 <p className="text-sm text-muted-foreground">{aiData?.summary}</p>
 {aiData?.recommendations?.slice(0, 4).map((rec: any, idx: number) => (
 <div key={idx} className={`p-3 rounded-lg border-l-4 ${rec.priority ==='high' ?'border-l-red-500 bg-destructive/5' : rec.priority ==='medium' ?'border-l-yellow-500 bg-warning/5' :'border-l-blue-500 bg-info/5'}`}>
 <div className="flex items-center gap-2 mb-1">
 <Badge variant="outline" className="text-xs">{rec.priority}</Badge>
 <span className="font-medium text-sm">{rec.title}</span>
 </div>
 <p className="text-sm text-muted-foreground">{rec.description}</p>
 <p className="text-xs text-success mt-1">{rec.impact}</p>
 </div>
 ))}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="report">
 <Card>
 <CardHeader><CardTitle>Monthly Performance Report</CardTitle></CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-3 gap-4">
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-3xl font-bold text-primary">{metrics.impressions}</p>
 <p className="text-sm text-muted-foreground">Total Impressions</p>
 </div>
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-3xl font-bold text-success">{metrics.clicks}</p>
 <p className="text-sm text-muted-foreground">Total Clicks</p>
 </div>
 <div className="text-center p-4 rounded-lg bg-muted">
 <p className="text-3xl font-bold text-accent">{analyticsData.rankingScore}/100</p>
 <p className="text-sm text-muted-foreground">Ranking Score</p>
 </div>
 </div>
 <p className="text-sm text-muted-foreground">Your Search Ranking Booster is active and enhancing visibility by {analyticsData.visibilityIncrease}% with a {analyticsData.boostMultiplier}x boost multiplier.</p>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
}
