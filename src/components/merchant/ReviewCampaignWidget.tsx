import { useState, useEffect } from'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Button } from'@/components/ui/button';
import { Badge } from'@/components/ui/badge';
import { Progress } from'@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from'@/components/ui/tabs';
import { ScrollArea } from'@/components/ui/scroll-area';
import { GradientCard } from'@/components/ui/gradient-card';
import { 
 Star, 
 MessageSquare, 
 TrendingUp,
 Users,
 Mail,
 ThumbsUp,
 ThumbsDown,
 Minus,
 RefreshCw,
 Lightbulb,
 CheckCircle,
 AlertTriangle,
 Info,
 Zap,
 Target,
 BarChart3,
 Brain,
 Send,
 Clock,
 Award,
 Camera
} from'lucide-react';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from'recharts';
import { Link } from'react-router-dom';

interface ReviewCampaignData {
 hasService: boolean;
 merchant: {
 id: string;
 business_name: string;
 business_type: string;
 };
 metrics: {
 totalReviews: number;
 averageRating: number;
 reviewRate: number;
 reviewsWithText: number;
 textPercentage: number;
 uniqueCustomers: number;
 totalTransactions: number;
 };
 ratingDistribution: Array<{ rating: number; count: number; percentage: number }>;
 sentimentBreakdown: { positive: number; neutral: number; negative: number };
 monthlyTrends: Array<{ month: string; reviews: number; avgRating: number }>;
 recentReviews: Array<{
 id: string;
 rating: number;
 review_text: string;
 created_at: string;
 sentiment:'positive' |'neutral' |'negative';
 }>;
 aiInsights: Array<{
 type:'success' |'warning' |'info' |'opportunity';
 title: string;
 description: string;
 priority: string;
 action?: string;
 }>;
 campaignSuggestions: Array<{
 id: string;
 name: string;
 description: string;
 status: string;
 expectedImpact: string;
 difficulty: string;
 }>;
 responseMetrics: {
 averageResponseTime: string;
 responseRate: number;
 positiveResponseImpact: string;
 };
 campaignStats: {
 activeTemplates: number;
 emailsSent: number;
 clickRate: number;
 conversionRate: number;
 };
}

const COLORS = {
 positive:'hsl(142, 76%, 36%)',
 neutral:'hsl(45, 93%, 47%)',
 negative:'hsl(0, 84%, 60%)',
};

export function ReviewCampaignWidget() {
 const [data, setData] = useState<ReviewCampaignData | null>(null);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);

 const fetchData = async () => {
 try {
 const { data: responseData, error } = await supabase.functions.invoke('review-campaign-dashboard');
 
 if (error) throw error;
 setData(responseData);
 } catch (error: any) {
 console.error('Error fetching review campaign data:', error);
 toast({
 title:'Error',
 description: error.message ||'Failed to load review campaign data',
 variant:'destructive',
 });
 } finally {
 setLoading(false);
 setRefreshing(false);
 }
 };

 useEffect(() => {
 fetchData();
 }, []);

 const handleRefresh = () => {
 setRefreshing(true);
 fetchData();
 };

 const getRatingColor = (rating: number) => {
 if (rating >= 4.5) return'text-success';
 if (rating >= 4.0) return'text-success';
 if (rating >= 3.0) return'text-warning';
 return'text-destructive';
 };

 const getInsightIcon = (type: string) => {
 switch (type) {
 case'success': return <CheckCircle className="h-5 w-5 text-success" />;
 case'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
 case'info': return <Info className="h-5 w-5 text-info" />;
 case'opportunity': return <Lightbulb className="h-5 w-5 text-accent" />;
 default: return <Info className="h-5 w-5" />;
 }
 };

 const getPriorityColor = (priority: string) => {
 switch (priority) {
 case'high': return'bg-destructive/10 text-destructive border-destructive/20';
 case'medium': return'bg-warning/10 text-warning border-warning/20';
 case'low': return'bg-success/10 text-success border-success/20';
 default: return'bg-muted text-muted-foreground';
 }
 };

 const getDifficultyBadge = (difficulty: string) => {
 switch (difficulty) {
 case'easy': return <Badge variant="outline" className="bg-success/10 text-success text-xs">Quick Setup</Badge>;
 case'moderate': return <Badge variant="outline" className="bg-warning/10 text-warning text-xs">Some Setup</Badge>;
 case'complex': return <Badge variant="outline" className="bg-accent/10 text-accent text-xs">Advanced</Badge>;
 default: return null;
 }
 };

 const getSentimentIcon = (sentiment: string) => {
 switch (sentiment) {
 case'positive': return <ThumbsUp className="h-4 w-4 text-success" />;
 case'negative': return <ThumbsDown className="h-4 w-4 text-destructive" />;
 default: return <Minus className="h-4 w-4 text-warning" />;
 }
 };

 if (loading) {
 return (
 <Card>
 <CardContent className="p-8">
 <div className="flex items-center justify-center gap-3">
 <RefreshCw className="h-5 w-5 animate-spin text-primary" />
 <span className="text-muted-foreground">Loading review campaign data...</span>
 </div>
 </CardContent>
 </Card>
 );
 }

 if (!data?.hasService) {
 return (
 <Card className="border-dashed">
 <CardContent className="py-12 text-center">
 <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="font-semibold mb-2">Review Generation Campaign</h3>
 <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
 Boost your reviews with automated follow-up campaigns, AI-powered insights, 
 and sentiment analysis to turn customers into advocates.
 </p>
 <Button asChild><Link to="/merchant/market">Get Review Campaign</Link></Button>
 </CardContent>
 </Card>
 );
 }

 const { metrics, ratingDistribution, sentimentBreakdown, monthlyTrends, recentReviews, aiInsights, campaignSuggestions, responseMetrics, campaignStats } = data;

 const sentimentData = [
 { name:'Positive', value: sentimentBreakdown.positive, color: COLORS.positive },
 { name:'Neutral', value: sentimentBreakdown.neutral, color: COLORS.neutral },
 { name:'Negative', value: sentimentBreakdown.negative, color: COLORS.negative },
 ];

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold flex items-center gap-2">
 <Star className="h-6 w-6 text-primary" />
 Review Generation Campaign
 </h2>
 <p className="text-muted-foreground">
 {data.merchant.business_name} • Turn customers into advocates
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
 {refreshing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
 Refresh
 </Button>
 <Badge className="bg-gradient-to-r from-warning to-warning text-white gap-1">
 <Zap className="h-3 w-3" /> Campaign Active
 </Badge>
 </div>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-warning/10"><Star className="h-5 w-5 text-warning" /></div>
 <div>
 <p className="text-sm text-muted-foreground">Avg Rating</p>
 <p className={`text-2xl font-bold ${getRatingColor(metrics.averageRating)}`}>
 {metrics.averageRating.toFixed(1)} ★
 </p>
 </div>
 </div>
 </GradientCard>
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-primary/10"><MessageSquare className="h-5 w-5 text-primary" /></div>
 <div>
 <p className="text-sm text-muted-foreground">Total Reviews</p>
 <p className="text-2xl font-bold">{metrics.totalReviews}</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-success/10"><Target className="h-5 w-5 text-success" /></div>
 <div>
 <p className="text-sm text-muted-foreground">Review Rate</p>
 <p className="text-2xl font-bold">{metrics.reviewRate}%</p>
 </div>
 </div>
 </GradientCard>
 <GradientCard gradient>
 <div className="flex items-center gap-3">
 <div className="p-3 rounded-md bg-accent/10"><Users className="h-5 w-5 text-accent" /></div>
 <div>
 <p className="text-sm text-muted-foreground">Customers</p>
 <p className="text-2xl font-bold">{metrics.uniqueCustomers}</p>
 </div>
 </div>
 </GradientCard>
 </div>

 <Tabs defaultValue="overview" className="space-y-4">
 <TabsList className="grid w-full grid-cols-5">
 <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
 <TabsTrigger value="campaigns"><Send className="h-4 w-4 mr-1" /> Campaigns</TabsTrigger>
 <TabsTrigger value="reviews"><MessageSquare className="h-4 w-4 mr-1" /> Reviews</TabsTrigger>
 <TabsTrigger value="insights"><Brain className="h-4 w-4 mr-1" /> AI Insights</TabsTrigger>
 <TabsTrigger value="trends"><TrendingUp className="h-4 w-4 mr-1" /> Trends</TabsTrigger>
 </TabsList>

 {/* Overview Tab */}
 <TabsContent value="overview" className="space-y-4">
 <div className="grid md:grid-cols-2 gap-4">
 {/* Rating Distribution */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Star className="h-5 w-5 text-warning" />
 Rating Distribution
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {ratingDistribution.map(item => (
 <div key={item.rating} className="flex items-center gap-3">
 <span className="w-8 text-sm font-medium">{item.rating}★</span>
 <Progress value={item.percentage} className="flex-1 h-3" />
 <span className="w-12 text-sm text-muted-foreground text-right">{item.count}</span>
 </div>
 ))}
 </CardContent>
 </Card>

 {/* Sentiment Breakdown */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <ThumbsUp className="h-5 w-5 text-success" />
 Sentiment Analysis
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={sentimentData}
 cx="50%"
 cy="50%"
 innerRadius={50}
 outerRadius={80}
 paddingAngle={2}
 dataKey="value"
 >
 {sentimentData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip />
 </PieChart>
 </ResponsiveContainer>
 </div>
 <div className="flex justify-center gap-6 mt-2">
 {sentimentData.map(item => (
 <div key={item.name} className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
 <span className="text-sm">{item.name}: {item.value}</span>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Campaign Performance Stats */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Mail className="h-5 w-5 text-primary" />
 Campaign Performance
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold text-primary">{campaignStats.activeTemplates}</div>
 <div className="text-sm text-muted-foreground">Active Templates</div>
 </div>
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold text-info">{campaignStats.emailsSent}</div>
 <div className="text-sm text-muted-foreground">Emails Sent</div>
 </div>
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold text-success">{campaignStats.clickRate}%</div>
 <div className="text-sm text-muted-foreground">Click Rate</div>
 </div>
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold text-accent">{campaignStats.conversionRate}%</div>
 <div className="text-sm text-muted-foreground">Conversion Rate</div>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Campaigns Tab */}
 <TabsContent value="campaigns" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Send className="h-5 w-5 text-primary" />
 Campaign Strategies
 </CardTitle>
 <CardDescription>
 Implement these campaigns to boost your review collection
 </CardDescription>
 </CardHeader>
 <CardContent>
 <ScrollArea className="h-[400px] pr-4">
 <div className="space-y-4">
 {campaignSuggestions.map((campaign) => (
 <div 
 key={campaign.id} 
 className={`p-4 rounded-lg border ${campaign.status ==='active' ?'bg-success/5 border-success/20' :'bg-card'}`}
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <Badge variant={campaign.status ==='active' ?'default' :'secondary'}>
 {campaign.status ==='active' ?'Active' :'Suggested'}
 </Badge>
 {getDifficultyBadge(campaign.difficulty)}
 </div>
 <h4 className="font-semibold mb-1 flex items-center gap-2">
 {campaign.id ==='post-visit' && <Clock className="h-4 w-4" />}
 {campaign.id ==='loyalty-program' && <Award className="h-4 w-4" />}
 {campaign.id ==='photo-reviews' && <Camera className="h-4 w-4" />}
 {campaign.name}
 </h4>
 <p className="text-sm text-muted-foreground mb-2">
 {campaign.description}
 </p>
 <div className="flex items-center gap-1 text-sm text-success">
 <TrendingUp className="h-4 w-4" />
 <span>Expected: {campaign.expectedImpact}</span>
 </div>
 </div>
 {campaign.status ==='active' ? (
 <CheckCircle className="h-6 w-6 text-success shrink-0" />
 ) : (
 <Button size="sm" variant="outline">
 Enable
 </Button>
 )}
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 </CardContent>
 </Card>

 {/* Response Metrics */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Clock className="h-5 w-5 text-primary" />
 Response Performance
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-3 gap-4">
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold text-primary">{responseMetrics.averageResponseTime}</div>
 <div className="text-sm text-muted-foreground">Avg Response Time</div>
 </div>
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold text-success">{responseMetrics.responseRate}%</div>
 <div className="text-sm text-muted-foreground">Response Rate</div>
 </div>
 <div className="text-center p-4 bg-muted rounded-lg">
 <div className="text-2xl font-bold text-accent">{responseMetrics.positiveResponseImpact}</div>
 <div className="text-sm text-muted-foreground">Rating Impact</div>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Reviews Tab */}
 <TabsContent value="reviews">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <MessageSquare className="h-5 w-5 text-primary" />
 Recent Reviews
 </CardTitle>
 <CardDescription>
 {metrics.reviewsWithText} of {metrics.totalReviews} reviews include text ({metrics.textPercentage}%)
 </CardDescription>
 </CardHeader>
 <CardContent>
 <ScrollArea className="h-[400px] pr-4">
 <div className="space-y-4">
 {recentReviews.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
 <p>No reviews yet. Start your review campaign to collect feedback!</p>
 </div>
 ) : (
 recentReviews.map((review) => (
 <div key={review.id} className="p-4 rounded-lg border hover:bg-muted transition-colors">
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <div className="flex">
 {[1, 2, 3, 4, 5].map((star) => (
 <Star
 key={star}
 className={`h-4 w-4 ${star <= review.rating ?'text-gold fill-gold' :'text-muted'}`}
 />
 ))}
 </div>
 {getSentimentIcon(review.sentiment)}
 <span className="text-xs text-muted-foreground">
 {new Date(review.created_at).toLocaleDateString()}
 </span>
 </div>
 {review.review_text ? (
 <p className="text-sm">{review.review_text}</p>
 ) : (
 <p className="text-sm text-muted-foreground italic">No text provided</p>
 )}
 </div>
 </div>
 </div>
 ))
 )}
 </div>
 </ScrollArea>
 </CardContent>
 </Card>
 </TabsContent>

 {/* AI Insights Tab */}
 <TabsContent value="insights">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Brain className="h-5 w-5 text-accent" />
 AI-Powered Insights
 </CardTitle>
 <CardDescription>
 Personalized recommendations to improve your review performance
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {aiInsights.map((insight, idx) => (
 <div 
 key={idx} 
 className={`p-4 rounded-lg border-l-4 ${
 insight.type ==='success' ?'border-l-green-500 bg-success/5' :
 insight.type ==='warning' ?'border-l-yellow-500 bg-warning/5' :
 insight.type ==='opportunity' ?'border-l-purple-500 bg-accent/5' :
'border-l-blue-500 bg-info/5'
 }`}
 >
 <div className="flex items-start gap-3">
 {getInsightIcon(insight.type)}
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-semibold">{insight.title}</h4>
 <Badge className={getPriorityColor(insight.priority)} variant="outline">
 {insight.priority}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground">{insight.description}</p>
 {insight.action && (
 <Button size="sm" variant="outline" className="mt-2">
 {insight.action}
 </Button>
 )}
 </div>
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
 <CardTitle>Review Volume Trend</CardTitle>
 <CardDescription>Monthly review collection over the last 6 months</CardDescription>
 </CardHeader>
 <CardContent className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={monthlyTrends}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="month" fontSize={12} />
 <YAxis fontSize={12} />
 <Tooltip />
 <Bar dataKey="reviews" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Rating Trend</CardTitle>
 <CardDescription>Average rating over time</CardDescription>
 </CardHeader>
 <CardContent className="h-64">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={monthlyTrends}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="month" fontSize={12} />
 <YAxis domain={[0, 5]} fontSize={12} />
 <Tooltip />
 <Line 
 type="monotone" 
 dataKey="avgRating" 
 stroke="hsl(var(--chart-2))" 
 strokeWidth={2}
 dot={{ fill:'hsl(var(--chart-2))' }}
 />
 </LineChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
}
