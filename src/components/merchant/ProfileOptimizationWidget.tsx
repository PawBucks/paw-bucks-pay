import { useState, useEffect } from'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from'@/components/ui/card';
import { Button } from'@/components/ui/button';
import { Badge } from'@/components/ui/badge';
import { Progress } from'@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from'@/components/ui/tabs';
import { ScrollArea } from'@/components/ui/scroll-area';
import { 
 Sparkles, 
 CheckCircle, 
 AlertTriangle, 
 Info, 
 TrendingUp,
 Image,
 MapPin,
 FileText,
 Star,
 Target,
 Users,
 BarChart3,
 Lightbulb,
 ArrowUp,
 ArrowDown,
 Minus,
 RefreshCw,
 Download,
 Trophy,
 Zap
} from'lucide-react';
import { supabase } from'@/integrations/supabase/client';
import { toast } from'@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, BarChart, Bar } from'recharts';

interface ProfileAnalysis {
 overallScore: number;
 completenessScore: number;
 seoScore: number;
 localScore: number;
 categoryScore: number;
 sections: SectionAnalysis[];
 recommendations: Recommendation[];
 competitorComparison: CompetitorData;
 historicalMetrics: HistoricalMetric[];
 aiInsights: AIInsight[];
 merchant: {
 id: string;
 business_name: string;
 business_type: string;
 logo_url: string | null;
 };
}

interface SectionAnalysis {
 name: string;
 score: number;
 maxScore: number;
 status:'complete' |'partial' |'missing';
 issues: string[];
 suggestions: string[];
}

interface Recommendation {
 id: string;
 priority:'high' |'medium' |'low';
 category: string;
 title: string;
 description: string;
 impact: string;
 effort:'easy' |'moderate' |'complex';
 completed: boolean;
}

interface CompetitorData {
 yourRank: number;
 totalCompetitors: number;
 avgCompetitorScore: number;
 topPerformerScore: number;
 comparisonAreas: { area: string; yourScore: number; avgScore: number }[];
}

interface HistoricalMetric {
 date: string;
 overallScore: number;
 completenessScore: number;
 seoScore: number;
 views: number;
 clicks: number;
}

interface AIInsight {
 type:'success' |'warning' |'info' |'opportunity';
 title: string;
 description: string;
 action?: string;
}

export function ProfileOptimizationWidget() {
 const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);

 const fetchAnalysis = async () => {
 try {
 const { data, error } = await supabase.functions.invoke('merchant-profile-optimization');
 
 if (error) throw error;
 setAnalysis(data);
 } catch (error: any) {
 console.error('Error fetching profile analysis:', error);
 toast({
 title:'Error',
 description: error.message ||'Failed to load profile analysis',
 variant:'destructive',
 });
 } finally {
 setLoading(false);
 setRefreshing(false);
 }
 };

 useEffect(() => {
 fetchAnalysis();
 }, []);

 const handleRefresh = () => {
 setRefreshing(true);
 fetchAnalysis();
 };

 const getScoreColor = (score: number) => {
 if (score >= 80) return'text-success';
 if (score >= 60) return'text-warning';
 if (score >= 40) return'text-warning0';
 return'text-destructive';
 };

 const getScoreGradient = (score: number) => {
 if (score >= 80) return'from-success0 to-success0';
 if (score >= 60) return'from-warning0 to-warning0';
 if (score >= 40) return'from-warning0 to-warning0';
 return'from-destructive0 to-destructive0';
 };

 const getPriorityColor = (priority: string) => {
 switch (priority) {
 case'high': return'bg-destructive/10 text-destructive border-destructive/20';
 case'medium': return'bg-warning/10 text-warning border-warning/20';
 case'low': return'bg-info/10 text-info border-info/20';
 default: return'bg-muted text-muted-foreground';
 }
 };

 const getEffortBadge = (effort: string) => {
 switch (effort) {
 case'easy': return <Badge variant="outline" className="bg-success/10 text-success text-xs">Quick Fix</Badge>;
 case'moderate': return <Badge variant="outline" className="bg-warning/10 text-warning text-xs">Some Effort</Badge>;
 case'complex': return <Badge variant="outline" className="bg-accent/100/10 text-accent0 text-xs">Project</Badge>;
 default: return null;
 }
 };

 const getInsightIcon = (type: string) => {
 switch (type) {
 case'success': return <CheckCircle className="h-5 w-5 text-success" />;
 case'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
 case'info': return <Info className="h-5 w-5 text-info" />;
 case'opportunity': return <Lightbulb className="h-5 w-5 text-accent0" />;
 default: return <Info className="h-5 w-5" />;
 }
 };

 const getSectionIcon = (name: string) => {
 switch (name) {
 case'Business Information': return <FileText className="h-4 w-4" />;
 case'Visual Branding': return <Image className="h-4 w-4" />;
 case'Contact & Location': return <MapPin className="h-4 w-4" />;
 case'Services & Offers': return <Target className="h-4 w-4" />;
 case'Reputation': return <Star className="h-4 w-4" />;
 default: return <Info className="h-4 w-4" />;
 }
 };

 if (loading) {
 return (
 <Card>
 <CardContent className="p-8">
 <div className="flex items-center justify-center gap-3">
 <RefreshCw className="h-5 w-5 animate-spin text-primary" />
 <span className="text-muted-foreground">Analyzing your profile...</span>
 </div>
 </CardContent>
 </Card>
 );
 }

 if (!analysis) {
 return (
 <Card>
 <CardContent className="p-8 text-center">
 <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
 <p className="text-muted-foreground">Unable to load profile analysis.</p>
 <Button onClick={handleRefresh} className="mt-4">
 Try Again
 </Button>
 </CardContent>
 </Card>
 );
 }

 const radarData = analysis.competitorComparison.comparisonAreas.map(area => ({
 subject: area.area,
 You: area.yourScore,
 Average: area.avgScore,
 }));

 const scoreChangeData = analysis.historicalMetrics.slice(-7).map(m => ({
 date: new Date(m.date).toLocaleDateString('en-US', { weekday:'short' }),
 score: m.overallScore,
 views: m.views,
 clicks: m.clicks,
 }));

 return (
 <div className="space-y-6">
 {/* Header with Overall Score */}
 <Card className="overflow-hidden">
 <div className={`bg-gradient-to-r ${getScoreGradient(analysis.overallScore)} p-6`}>
 <div className="flex items-center justify-between">
 <div className="text-white">
 <div className="flex items-center gap-2 mb-2">
 <Sparkles className="h-6 w-6" />
 <h2 className="text-xl font-bold">Profile Optimization Score</h2>
 </div>
 <p className="text-white/80 text-sm">
 {analysis.merchant.business_name} • {analysis.merchant.business_type}
 </p>
 </div>
 <div className="text-center">
 <div className="text-5xl font-bold text-white">{analysis.overallScore}</div>
 <div className="text-white/80 text-sm">out of 100</div>
 </div>
 </div>
 </div>
 
 <CardContent className="p-6">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="text-center p-4 bg-muted/50 rounded-lg">
 <div className={`text-2xl font-bold ${getScoreColor(analysis.completenessScore)}`}>
 {analysis.completenessScore}%
 </div>
 <div className="text-sm text-muted-foreground">Completeness</div>
 </div>
 <div className="text-center p-4 bg-muted/50 rounded-lg">
 <div className={`text-2xl font-bold ${getScoreColor(analysis.seoScore)}`}>
 {analysis.seoScore}%
 </div>
 <div className="text-sm text-muted-foreground">SEO Score</div>
 </div>
 <div className="text-center p-4 bg-muted/50 rounded-lg">
 <div className={`text-2xl font-bold ${getScoreColor(analysis.localScore)}`}>
 {analysis.localScore}%
 </div>
 <div className="text-sm text-muted-foreground">Local SEO</div>
 </div>
 <div className="text-center p-4 bg-muted/50 rounded-lg">
 <div className={`text-2xl font-bold ${getScoreColor(analysis.categoryScore)}`}>
 {analysis.categoryScore}%
 </div>
 <div className="text-sm text-muted-foreground">Category Match</div>
 </div>
 </div>
 
 <div className="flex justify-end mt-4">
 <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
 {refreshing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
 Refresh Analysis
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* Tabs for different sections */}
 <Tabs defaultValue="overview" className="w-full">
 <TabsList className="grid w-full grid-cols-5">
 <TabsTrigger value="overview">Overview</TabsTrigger>
 <TabsTrigger value="recommendations">Actions</TabsTrigger>
 <TabsTrigger value="competitors">Competitors</TabsTrigger>
 <TabsTrigger value="insights">AI Insights</TabsTrigger>
 <TabsTrigger value="trends">Trends</TabsTrigger>
 </TabsList>

 {/* Overview Tab */}
 <TabsContent value="overview" className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 {analysis.sections.map((section) => (
 <Card key={section.name}>
 <CardHeader className="pb-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 {getSectionIcon(section.name)}
 <CardTitle className="text-base">{section.name}</CardTitle>
 </div>
 <Badge 
 variant="outline" 
 className={
 section.status ==='complete' ?'bg-success/10 text-success' :
 section.status ==='partial' ?'bg-warning/10 text-warning' :
'bg-destructive/10 text-destructive'
 }
 >
 {section.status ==='complete' ?'Complete' : 
 section.status ==='partial' ?'Partial' :'Missing'}
 </Badge>
 </div>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <Progress 
 value={(section.score / section.maxScore) * 100} 
 className="flex-1 h-2"
 />
 <span className="text-sm font-medium">
 {section.score}/{section.maxScore}
 </span>
 </div>
 
 {section.issues.length > 0 && (
 <div className="space-y-1">
 {section.issues.map((issue, i) => (
 <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
 <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
 <span>{issue}</span>
 </div>
 ))}
 </div>
 )}
 
 {section.suggestions.length > 0 && section.status !=='complete' && (
 <div className="pt-2 border-t space-y-1">
 {section.suggestions.slice(0, 2).map((suggestion, i) => (
 <div key={i} className="flex items-start gap-2 text-sm text-primary">
 <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
 <span>{suggestion}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </TabsContent>

 {/* Recommendations Tab */}
 <TabsContent value="recommendations">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Zap className="h-5 w-5 text-primary" />
 Optimization Actions
 </CardTitle>
 <CardDescription>
 Complete these tasks to improve your profile visibility and engagement
 </CardDescription>
 </CardHeader>
 <CardContent>
 <ScrollArea className="h-[500px] pr-4">
 <div className="space-y-4">
 {analysis.recommendations.map((rec) => (
 <div 
 key={rec.id} 
 className={`p-4 rounded-lg border ${rec.completed ?'bg-muted/50 opacity-60' :'bg-card'}`}
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <Badge className={getPriorityColor(rec.priority)}>
 {rec.priority.toUpperCase()}
 </Badge>
 <Badge variant="outline" className="text-xs">
 {rec.category}
 </Badge>
 {getEffortBadge(rec.effort)}
 </div>
 <h4 className="font-semibold mb-1">{rec.title}</h4>
 <p className="text-sm text-muted-foreground mb-2">
 {rec.description}
 </p>
 <div className="flex items-center gap-1 text-sm text-success">
 <TrendingUp className="h-4 w-4" />
 <span>{rec.impact}</span>
 </div>
 </div>
 {rec.completed ? (
 <CheckCircle className="h-6 w-6 text-success shrink-0" />
 ) : (
 <Button size="sm" variant="outline">
 Start
 </Button>
 )}
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Competitors Tab */}
 <TabsContent value="competitors" className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Trophy className="h-5 w-5 text-warning" />
 Your Ranking
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-center py-6">
 <div className="text-6xl font-bold text-primary mb-2">
 #{analysis.competitorComparison.yourRank}
 </div>
 <p className="text-muted-foreground">
 out of {analysis.competitorComparison.totalCompetitors + 1} {analysis.merchant.business_type} businesses
 </p>
 <div className="mt-4 grid grid-cols-2 gap-4">
 <div className="p-3 bg-muted/50 rounded-lg">
 <div className="text-lg font-semibold">
 {analysis.competitorComparison.avgCompetitorScore}
 </div>
 <div className="text-xs text-muted-foreground">Avg Score</div>
 </div>
 <div className="p-3 bg-muted/50 rounded-lg">
 <div className="text-lg font-semibold">
 {analysis.competitorComparison.topPerformerScore}
 </div>
 <div className="text-xs text-muted-foreground">Top Score</div>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <BarChart3 className="h-5 w-5 text-primary" />
 Performance Comparison
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-[250px]">
 <ResponsiveContainer width="100%" height="100%">
 <RadarChart data={radarData}>
 <PolarGrid strokeDasharray="3 3" />
 <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
 <PolarRadiusAxis angle={30} domain={[0, 100]} />
 <Radar name="You" dataKey="You" stroke="hsl(var(--chart-6))" fill="hsl(var(--chart-6))" fillOpacity={0.5} />
 <Radar name="Average" dataKey="Average" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.2} />
 <Legend />
 </RadarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle>Detailed Comparison</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {analysis.competitorComparison.comparisonAreas.map((area) => {
 const diff = area.yourScore - area.avgScore;
 return (
 <div key={area.area} className="flex items-center gap-4">
 <div className="w-40 text-sm font-medium">{area.area}</div>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <Progress value={area.yourScore} className="flex-1 h-2" />
 <span className="text-sm w-12 text-right">{area.yourScore}%</span>
 </div>
 </div>
 <div className={`flex items-center gap-1 w-20 justify-end text-sm ${
 diff > 0 ?'text-success' : diff < 0 ?'text-destructive' :'text-muted-foreground'
 }`}>
 {diff > 0 ? <ArrowUp className="h-4 w-4" /> : 
 diff < 0 ? <ArrowDown className="h-4 w-4" /> : 
 <Minus className="h-4 w-4" />}
 {Math.abs(diff)}% vs avg
 </div>
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 {/* AI Insights Tab */}
 <TabsContent value="insights">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Sparkles className="h-5 w-5 text-accent0" />
 AI-Powered Insights
 </CardTitle>
 <CardDescription>
 Personalized recommendations based on your profile analysis
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {analysis.aiInsights.map((insight, index) => (
 <div 
 key={index}
 className={`p-4 rounded-lg border ${
 insight.type ==='success' ?'bg-success/5 border-success/20' :
 insight.type ==='warning' ?'bg-warning/5 border-warning/20' :
 insight.type ==='opportunity' ?'bg-accent/100/5 border-accent/200/20' :
'bg-info/5 border-info/20'
 }`}
 >
 <div className="flex items-start gap-3">
 {getInsightIcon(insight.type)}
 <div className="flex-1">
 <h4 className="font-semibold mb-1">{insight.title}</h4>
 <p className="text-sm text-muted-foreground mb-2">
 {insight.description}
 </p>
 {insight.action && (
 <div className="flex items-center gap-2 text-sm font-medium text-primary">
 <Zap className="h-4 w-4" />
 <span>{insight.action}</span>
 </div>
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
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="flex items-center gap-2">
 <TrendingUp className="h-5 w-5 text-primary" />
 Score History
 </CardTitle>
 <CardDescription>Track your optimization progress over time</CardDescription>
 </div>
 <Button variant="outline" size="sm">
 <Download className="h-4 w-4 mr-2" />
 Export Report
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 <div className="h-[300px]">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={scoreChangeData}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
 <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
 <Tooltip 
 contentStyle={{ 
 backgroundColor:'hsl(var(--card))', 
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px',
 }} 
 />
 <Line 
 type="monotone" 
 dataKey="score" 
 stroke="hsl(var(--chart-5))" 
 strokeWidth={2}
 dot={{ fill:'hsl(var(--chart-5))' }}
 name="Overall Score"
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Users className="h-5 w-5 text-primary" />
 Visibility Metrics
 </CardTitle>
 <CardDescription>How your profile improvements affect traffic</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-[250px]">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={scoreChangeData}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
 <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
 <Tooltip 
 contentStyle={{ 
 backgroundColor:'hsl(var(--card))', 
 border:'1px solid hsl(var(--border))',
 borderRadius:'8px',
 }} 
 />
 <Bar dataKey="views" fill="hsl(var(--chart-6))" name="Views" radius={[4, 4, 0, 0]} />
 <Bar dataKey="clicks" fill="hsl(var(--chart-4))" name="Clicks" radius={[4, 4, 0, 0]} />
 <Legend />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
}
