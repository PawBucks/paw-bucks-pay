import { useState } from"react";
import { useQuery } from"@tanstack/react-query";
import { supabase } from"@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Button } from"@/components/ui/button";
import { Progress } from"@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Skeleton } from"@/components/ui/skeleton";
import { Crown, Shield, Calendar, TrendingUp, CheckCircle2, AlertCircle, Megaphone, Mail, Users, Award, Target, Lightbulb, ArrowRight, HeartHandshake } from "lucide-react";
import { format, formatDistanceToNow } from"date-fns";

import { Formatters } from "@/utils/formatters";
interface FeaturedPartnerData {
 hasSubscription: boolean;
 subscription?: {
 id: string;
 startDate: string;
 expiresAt: string;
 daysUntilRenewal: number;
 amountPaid: number;
 paymentMethod:'usd' |'pawbucks';
 };
 partner?: {
 tier:'bronze' |'silver' |'gold';
 tierProgress: number;
 tenureMonths: number;
 nextTier: string | null;
 monthsToNextTier: number;
 };
 metrics?: {
 totalRevenue: number;
 totalTransactions: number;
 avgRating: number;
 customerGrowth: number;
 reviewCount: number;
 };
 benefits?: Array<{
 id: string;
 name: string;
 description: string;
 status:'available' |'used' |'pending';
 usedAt?: string;
 expiresAt?: string;
 }>;
 benefitsUtilization?: {
 total: number;
 used: number;
 available: number;
 utilizationRate: number;
 };
 coMarketingOpportunities?: Array<{
 id: string;
 title: string;
 description: string;
 type:'email_campaign' |'social_media' |'blog_feature' |'event';
 status:'open' |'applied' |'approved' |'completed';
 deadline?: string;
 reward?: string;
 }>;
 quarterlyReviews?: Array<{
 quarter: string;
 scheduledDate?: string;
 status:'scheduled' |'completed' |'pending';
 notes?: string;
 metrics?: {
 totalRevenue: number;
 totalTransactions: number;
 customerGrowth: number;
 avgRating: number;
 };
 }>;
 aiInsights?: Array<{
 title: string;
 recommendation: string;
 priority:'high' |'medium' |'low';
 category:'growth' |'engagement' |'optimization' |'marketing';
 }>;
}

const tierColors = {
 bronze:'from-warning to-warning',
 silver:'from-muted to-muted',
 gold:'from-warning to-warning',
};

const tierIcons = {
 bronze: Crown,
 silver: Shield,
 gold: Award,
};

const priorityColors = {
 high:'bg-destructive/15 text-destructive border-destructive/30',
 medium:'bg-warning/15 text-warning border-warning/30',
 low:'bg-success/15 text-success border-success/30',
};

const categoryIcons = {
 growth: TrendingUp,
 engagement: Users,
 optimization: Target,
 marketing: Megaphone,
};

const opportunityTypeIcons = {
 email_campaign: Mail,
 social_media: Users,
 blog_feature: Lightbulb,
 event: Calendar,
};

export function FeaturedPartnerWidget() {
 const [activeTab, setActiveTab] = useState("overview");

 const { data, isLoading, error } = useQuery<FeaturedPartnerData>({
 queryKey: ['featured-partner-dashboard'],
 queryFn: async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) throw new Error('Not authenticated');

 const response = await supabase.functions.invoke('featured-partner-dashboard', {
 headers: { Authorization: `Bearer ${session.access_token}` },
 });

 if (response.error) throw response.error;
 return response.data;
 },
 staleTime: 5 * 60 * 1000,
 });

 if (isLoading) {
 return (
 <Card>
 <CardHeader>
 <Skeleton className="h-6 w-48" />
 <Skeleton className="h-4 w-64 mt-2" />
 </CardHeader>
 <CardContent className="space-y-4">
 <Skeleton className="h-32 w-full" />
 <Skeleton className="h-24 w-full" />
 </CardContent>
 </Card>
 );
 }

 if (error || !data?.hasSubscription) {
 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <span className="h-5 w-5 text-muted-foreground" aria-hidden="true">👑</span>
 Featured Partner Status
 </CardTitle>
 <CardDescription>
 Unlock exclusive benefits with Featured Partner Status
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="text-center py-8">
 <span className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true">👑</span>
 <p className="text-muted-foreground mb-4">
 You don't have an active Featured Partner subscription
 </p>
 <Button>
 <span className="mr-2 h-4 w-4" aria-hidden="true">👑</span>
 Become a Featured Partner
 </Button>
 </div>
 </CardContent>
 </Card>
 );
 }

 const TierIcon = tierIcons[data.partner?.tier ||'bronze'];

 return (
 <Card className="overflow-hidden">
 {/* Header with tier badge */}
 <div className={`bg-gradient-to-r ${tierColors[data.partner?.tier ||'bronze']} p-6 text-white`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-3 bg-white/20 rounded-full">
 <TierIcon className="h-8 w-8" />
 </div>
 <div>
 <h2 className="text-2xl font-bold capitalize">{data.partner?.tier} Partner</h2>
 <p className="text-white/80">
 {data.partner?.tenureMonths} months as a Featured Partner
 </p>
 </div>
 </div>
 <div className="text-right">
 <Badge variant="secondary" className="bg-white/20 text-white border-0 mb-1">
 {data.subscription?.daysUntilRenewal} days until renewal
 </Badge>
 <p className="text-sm text-white/70">
 Expires {data.subscription?.expiresAt && format(new Date(data.subscription.expiresAt),'MMM d, yyyy')}
 </p>
 </div>
 </div>

 {/* Tier progress */}
 {data.partner?.nextTier && (
 <div className="mt-4">
 <div className="flex justify-between text-sm mb-1">
 <span>Progress to {data.partner.nextTier}</span>
 <span>{data.partner.monthsToNextTier} months to go</span>
 </div>
 <Progress value={data.partner.tierProgress} className="h-2 bg-white/20" />
 </div>
 )}
 </div>

 <CardContent className="p-0">
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
 <TabsTrigger 
 value="overview" 
 className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
 >
 Overview
 </TabsTrigger>
 <TabsTrigger 
 value="benefits"
 className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
 >
 Benefits
 </TabsTrigger>
 <TabsTrigger 
 value="co-marketing"
 className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
 >
 Co-Marketing
 </TabsTrigger>
 <TabsTrigger 
 value="reviews"
 className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
 >
 Quarterly Reviews
 </TabsTrigger>
 <TabsTrigger 
 value="insights"
 className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
 >
 AI Insights
 </TabsTrigger>
 </TabsList>

 <div className="p-6">
 <TabsContent value="overview" className="m-0 space-y-6">
 {/* Quick stats */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-muted rounded-lg p-4 text-center">
 <span className="h-6 w-6 mx-auto mb-2 text-success" aria-hidden="true">📈</span>
 <p className="text-2xl font-bold">${Formatters.number(Math.round(data.metrics?.totalRevenue))}</p>
 <p className="text-xs text-muted-foreground">90-Day Revenue</p>
 </div>
 <div className="bg-muted rounded-lg p-4 text-center">
 <span className="h-6 w-6 mx-auto mb-2 text-info" aria-hidden="true">👥</span>
 <p className="text-2xl font-bold">{data.metrics?.totalTransactions}</p>
 <p className="text-xs text-muted-foreground">Transactions</p>
 </div>
 <div className="bg-muted rounded-lg p-4 text-center">
 <span className="h-6 w-6 mx-auto mb-2 text-warning" aria-hidden="true">⭐</span>
 <p className="text-2xl font-bold">{Formatters.decimal(data.metrics?.avgRating, 1)}</p>
 <p className="text-xs text-muted-foreground">Avg Rating</p>
 </div>
 <div className="bg-muted rounded-lg p-4 text-center">
 <span className="h-6 w-6 mx-auto mb-2 text-accent" aria-hidden="true">⚡</span>
 <p className="text-2xl font-bold">
 {data.metrics?.customerGrowth > 0 ?'+' :''}{Formatters.number(Math.round(data.metrics?.customerGrowth))}%
 </p>
 <p className="text-xs text-muted-foreground">Customer Growth</p>
 </div>
 </div>

 {/* Benefits utilization */}
 <div className="border rounded-lg p-4">
 <div className="flex justify-between items-center mb-4">
 <h3 className="font-semibold flex items-center gap-2">
 <span className="h-4 w-4" aria-hidden="true">🎁</span>
 Benefits Utilization
 </h3>
 <Badge variant="outline">
 {data.benefitsUtilization?.available} available
 </Badge>
 </div>
 <Progress 
 value={data.benefitsUtilization?.utilizationRate || 0} 
 className="h-3 mb-2" 
 />
 <div className="flex justify-between text-sm text-muted-foreground">
 <span>{data.benefitsUtilization?.used} used</span>
 <span>{data.benefitsUtilization?.total} total benefits</span>
 </div>
 </div>

 {/* Quick actions */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Button variant="outline" className="justify-start h-auto py-4">
 <HeartHandshake className="mr-3 h-5 w-5 text-primary" />
 <div className="text-left">
 <p className="font-medium">Contact Priority Support</p>
 <p className="text-xs text-muted-foreground">24-hour response guarantee</p>
 </div>
 </Button>
 <Button variant="outline" className="justify-start h-auto py-4">
 <span className="mr-3 h-5 w-5 text-primary" aria-hidden="true">📅</span>
 <div className="text-left">
 <p className="font-medium">Schedule Business Review</p>
 <p className="text-xs text-muted-foreground">One-on-one strategy session</p>
 </div>
 </Button>
 </div>
 </TabsContent>

 <TabsContent value="benefits" className="m-0 space-y-4">
 <div className="flex justify-between items-center">
 <h3 className="font-semibold">Your Partner Benefits</h3>
 <Badge variant="secondary">
 {data.partner?.tier} Tier
 </Badge>
 </div>
 
 <div className="space-y-3">
 {data.benefits?.map((benefit) => (
 <div 
 key={benefit.id} 
 className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
 >
 <div className="flex items-center gap-3">
 {benefit.status ==='available' && (
 <CheckCircle2 className="h-5 w-5 text-success" />
 )}
 {benefit.status ==='used' && (
 <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
 )}
 {benefit.status ==='pending' && (
 <span className="h-5 w-5 text-warning" aria-hidden="true">⏰</span>
 )}
 <div>
 <p className="font-medium">{benefit.name}</p>
 <p className="text-sm text-muted-foreground">{benefit.description}</p>
 </div>
 </div>
 <Badge 
 variant={benefit.status ==='available' ?'default' :'secondary'}
 className={benefit.status ==='pending' ?'bg-warning/15 text-warning' :''}
 >
 {benefit.status}
 </Badge>
 </div>
 ))}
 </div>
 </TabsContent>

 <TabsContent value="co-marketing" className="m-0 space-y-4">
 <div className="flex justify-between items-center">
 <h3 className="font-semibold">Co-Marketing Opportunities</h3>
 <Badge variant="outline">
 {data.coMarketingOpportunities?.filter(o => o.status ==='open').length} open
 </Badge>
 </div>

 <div className="space-y-4">
 {data.coMarketingOpportunities?.map((opportunity) => {
 const TypeIcon = opportunityTypeIcons[opportunity.type];
 return (
 <div 
 key={opportunity.id}
 className="border rounded-lg p-4 hover:border-primary transition-colors"
 >
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3">
 <div className="p-2 bg-primary/10 rounded-lg">
 <TypeIcon className="h-5 w-5 text-primary" />
 </div>
 <div>
 <h4 className="font-medium">{opportunity.title}</h4>
 <p className="text-sm text-muted-foreground mt-1">
 {opportunity.description}
 </p>
 {opportunity.reward && (
 <p className="text-sm text-primary mt-2 flex items-center gap-1">
 <span className="h-3 w-3" aria-hidden="true">🎁</span>
 {opportunity.reward}
 </p>
 )}
 </div>
 </div>
 <div className="text-right">
 <Badge 
 variant={opportunity.status ==='open' ?'default' :'secondary'}
 >
 {opportunity.status}
 </Badge>
 {opportunity.deadline && (
 <p className="text-xs text-muted-foreground mt-2">
 Deadline: {format(new Date(opportunity.deadline),'MMM d, yyyy')}
 </p>
 )}
 </div>
 </div>
 {opportunity.status ==='open' && (
 <div className="mt-4 pt-4 border-t">
 <Button size="sm">
 Apply Now
 <ArrowRight className="ml-2 h-4 w-4" />
 </Button>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </TabsContent>

 <TabsContent value="reviews" className="m-0 space-y-4">
 <h3 className="font-semibold">Quarterly Business Reviews</h3>
 
 <div className="space-y-4">
 {data.quarterlyReviews?.map((review) => (
 <div 
 key={review.quarter}
 className="border rounded-lg p-4"
 >
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <span className="h-5 w-5 text-primary" aria-hidden="true">📅</span>
 <h4 className="font-medium">{review.quarter}</h4>
 </div>
 <Badge 
 variant={review.status ==='completed' ?'secondary' : review.status ==='scheduled' ?'default' :'outline'}
 >
 {review.status ==='scheduled' && review.scheduledDate && (
 <span>Scheduled: {format(new Date(review.scheduledDate),'MMM d')}</span>
 )}
 {review.status !=='scheduled' && review.status}
 </Badge>
 </div>

 {review.metrics && (
 <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
 <div className="text-center">
 <p className="text-lg font-semibold">${Formatters.number(Math.round(review.metrics.totalRevenue))}</p>
 <p className="text-xs text-muted-foreground">Revenue</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-semibold">{review.metrics.totalTransactions}</p>
 <p className="text-xs text-muted-foreground">Transactions</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-semibold">
 {review.metrics.customerGrowth > 0 ?'+' :''}{review.metrics.customerGrowth}%
 </p>
 <p className="text-xs text-muted-foreground">Growth</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-semibold">{Formatters.decimal(review.metrics.avgRating, 1)}</p>
 <p className="text-xs text-muted-foreground">Rating</p>
 </div>
 </div>
 )}

 {review.status ==='pending' && (
 <div className="mt-4 pt-4 border-t">
 <Button size="sm" variant="outline">
 <span className="mr-2 h-4 w-4" aria-hidden="true">📅</span>
 Schedule Review
 </Button>
 </div>
 )}
 </div>
 ))}
 </div>
 </TabsContent>

 <TabsContent value="insights" className="m-0 space-y-4">
 <div className="flex items-center gap-2">
 <span className="h-5 w-5 text-primary" aria-hidden="true">💡</span>
 <h3 className="font-semibold">AI-Powered Recommendations</h3>
 </div>

 <div className="space-y-4">
 {data.aiInsights?.map((insight, index) => {
 const CategoryIcon = categoryIcons[insight.category];
 return (
 <div 
 key={index}
 className="border rounded-lg p-4 hover:border-primary transition-colors"
 >
 <div className="flex items-start gap-3">
 <div className="p-2 bg-primary/10 rounded-lg shrink-0">
 <CategoryIcon className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between">
 <h4 className="font-medium">{insight.title}</h4>
 <Badge 
 variant="outline" 
 className={priorityColors[insight.priority]}
 >
 {insight.priority} priority
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground mt-2">
 {insight.recommendation}
 </p>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 <div className="bg-muted rounded-lg p-4 mt-6">
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <AlertCircle className="h-4 w-4" />
 <span>Insights are updated based on your latest business metrics and market trends.</span>
 </div>
 </div>
 </TabsContent>
 </div>
 </Tabs>
 </CardContent>
 </Card>
 );
}
