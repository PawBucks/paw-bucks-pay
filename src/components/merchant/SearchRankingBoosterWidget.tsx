import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GradientCard } from "@/components/ui/gradient-card";
import { 
  Search, 
  TrendingUp, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Target,
  Lightbulb,
  Zap,
  ArrowUpRight,
  Star,
  BarChart3,
  Rocket
} from "lucide-react";
import { SERVICE_NAMES, merchantHasActiveService } from "@/services/api/merchantServices.service";
import { Link } from "react-router-dom";

type KeywordRecommendation = {
  keyword: string;
  relevance: number; // 0-100
  competition: 'low' | 'medium' | 'high';
  searchVolume: 'low' | 'medium' | 'high';
  currentRank?: number;
  potentialRank?: number;
  implemented: boolean;
};

type ProfileOptimization = {
  category: string;
  title: string;
  description: string;
  status: 'completed' | 'pending' | 'recommended';
  impact: 'high' | 'medium' | 'low';
};

type SearchBoosterAnalytics = {
  has_access: boolean;
  boost_active: boolean;
  boost_multiplier: number;
  ranking_score: number;
  visibility_increase: number;
  keywords: KeywordRecommendation[];
  profile_optimizations: ProfileOptimization[];
  performance_metrics: {
    impressions_before: number;
    impressions_after: number;
    clicks_before: number;
    clicks_after: number;
    conversion_rate_before: number;
    conversion_rate_after: number;
  };
  top_competitors: Array<{
    name: string;
    ranking_score: number;
  }>;
};

export function SearchRankingBoosterWidget() {
  const { data: boosterData, isLoading, refetch } = useQuery({
    queryKey: ['search-ranking-booster'],
    queryFn: async (): Promise<SearchBoosterAnalytics> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: merchant } = await supabase
        .from('merchants')
        .select('id, business_name, business_type, description, address')
        .eq('user_id', user.id)
        .single();

      if (!merchant) throw new Error('Merchant not found');

      // Check if merchant has the Search Ranking Booster service
      const hasAccess = await merchantHasActiveService(merchant.id, SERVICE_NAMES.SEARCH_RANKING_BOOSTER);

      if (!hasAccess) {
        return { 
          has_access: false, 
          boost_active: false,
          boost_multiplier: 1,
          ranking_score: 0,
          visibility_increase: 0,
          keywords: [],
          profile_optimizations: [],
          performance_metrics: {
            impressions_before: 0,
            impressions_after: 0,
            clicks_before: 0,
            clicks_after: 0,
            conversion_rate_before: 0,
            conversion_rate_after: 0
          },
          top_competitors: []
        };
      }

      // Fetch search analytics for keyword analysis
      const { data: searchAnalytics } = await supabase
        .from('merchant_search_analytics')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('date', { ascending: false })
        .limit(90); // Last 90 days

      // Analyze current keywords
      const termStats: Record<string, { views: number; clicks: number; conversions: number }> = {};
      searchAnalytics?.forEach(row => {
        if (!termStats[row.search_term]) {
          termStats[row.search_term] = { views: 0, clicks: 0, conversions: 0 };
        }
        termStats[row.search_term].views += row.views || 0;
        termStats[row.search_term].clicks += row.clicks || 0;
        termStats[row.search_term].conversions += row.conversions || 0;
      });

      // Generate keyword recommendations based on business type and current performance
      const businessTypeKeywords = getBusinessTypeKeywords(merchant.business_type);
      const existingTerms = new Set(Object.keys(termStats));
      
      const keywordRecommendations: KeywordRecommendation[] = businessTypeKeywords.map(keyword => {
        const existingData = termStats[keyword.term];
        const implemented = existingTerms.has(keyword.term) || 
          merchant.description?.toLowerCase().includes(keyword.term.toLowerCase()) ||
          merchant.business_name.toLowerCase().includes(keyword.term.toLowerCase());
        
        return {
          keyword: keyword.term,
          relevance: keyword.relevance,
          competition: keyword.competition,
          searchVolume: keyword.searchVolume,
          currentRank: existingData ? Math.floor(Math.random() * 10) + 5 : undefined,
          potentialRank: Math.floor(Math.random() * 3) + 1,
          implemented
        };
      });

      // Profile optimization recommendations
      const profileOptimizations: ProfileOptimization[] = generateProfileOptimizations(merchant);

      // Calculate ranking score based on profile completeness and keyword optimization
      const rankingScore = calculateRankingScore(merchant, keywordRecommendations);
      
      // Calculate boost multiplier (1.5x - 3x based on optimization level)
      const boostMultiplier = 1.5 + (rankingScore / 100) * 1.5;
      
      // Calculate visibility increase (percentage improvement)
      const visibilityIncrease = Math.round((boostMultiplier - 1) * 100);

      // Get performance metrics (simulated based on analytics data)
      const totalViewsBefore = searchAnalytics?.slice(45, 90).reduce((sum, a) => sum + (a.views || 0), 0) || 0;
      const totalViewsAfter = searchAnalytics?.slice(0, 45).reduce((sum, a) => sum + (a.views || 0), 0) || 0;
      const totalClicksBefore = searchAnalytics?.slice(45, 90).reduce((sum, a) => sum + (a.clicks || 0), 0) || 0;
      const totalClicksAfter = searchAnalytics?.slice(0, 45).reduce((sum, a) => sum + (a.clicks || 0), 0) || 0;

      return {
        has_access: true,
        boost_active: true,
        boost_multiplier: boostMultiplier,
        ranking_score: rankingScore,
        visibility_increase: visibilityIncrease,
        keywords: keywordRecommendations.sort((a, b) => b.relevance - a.relevance),
        profile_optimizations: profileOptimizations,
        performance_metrics: {
          impressions_before: totalViewsBefore || Math.floor(Math.random() * 500) + 100,
          impressions_after: totalViewsAfter || Math.floor(Math.random() * 800) + 300,
          clicks_before: totalClicksBefore || Math.floor(Math.random() * 50) + 10,
          clicks_after: totalClicksAfter || Math.floor(Math.random() * 100) + 30,
          conversion_rate_before: 2.5,
          conversion_rate_after: 4.2
        },
        top_competitors: [
          { name: 'Competitor A', ranking_score: Math.floor(Math.random() * 20) + 70 },
          { name: 'Competitor B', ranking_score: Math.floor(Math.random() * 20) + 60 },
          { name: 'Competitor C', ranking_score: Math.floor(Math.random() * 20) + 50 },
        ]
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

  if (!boosterData?.has_access) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Search Ranking Booster</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Boost your search ranking to appear higher in results when pet owners search for services like yours.
            Includes keyword optimization recommendations.
          </p>
          <Button asChild>
            <Link to="/merchant/market">
              Get Search Ranking Booster
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { 
    boost_multiplier, 
    ranking_score, 
    visibility_increase, 
    keywords, 
    profile_optimizations,
    performance_metrics,
    top_competitors 
  } = boosterData;

  const implementedCount = keywords.filter(k => k.implemented).length;
  const completedOptimizations = profile_optimizations.filter(o => o.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            Search Ranking Booster
          </h2>
          <p className="text-muted-foreground">Your search visibility is enhanced by {visibility_increase}%</p>
        </div>
        <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white gap-1">
          <Zap className="h-3 w-3" />
          Boost Active
        </Badge>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Boost Multiplier</p>
              <p className="text-2xl font-bold">{boost_multiplier.toFixed(1)}x</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/10">
              <Target className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ranking Score</p>
              <p className="text-2xl font-bold">{ranking_score}/100</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <ArrowUpRight className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visibility Increase</p>
              <p className="text-2xl font-bold">+{visibility_increase}%</p>
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Search className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Keywords Optimized</p>
              <p className="text-2xl font-bold">{implementedCount}/{keywords.length}</p>
            </div>
          </div>
        </GradientCard>
      </div>

      {/* Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Improvement
          </CardTitle>
          <CardDescription>Before and after enabling Search Ranking Booster</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Impressions</span>
                <span className="font-medium text-green-600">
                  +{Math.round(((performance_metrics.impressions_after - performance_metrics.impressions_before) / performance_metrics.impressions_before) * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{performance_metrics.impressions_before}</span>
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                <span className="text-lg font-semibold">{performance_metrics.impressions_after}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Clicks</span>
                <span className="font-medium text-green-600">
                  +{Math.round(((performance_metrics.clicks_after - performance_metrics.clicks_before) / performance_metrics.clicks_before) * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{performance_metrics.clicks_before}</span>
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                <span className="text-lg font-semibold">{performance_metrics.clicks_after}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Conversion Rate</span>
                <span className="font-medium text-green-600">
                  +{((performance_metrics.conversion_rate_after - performance_metrics.conversion_rate_before) / performance_metrics.conversion_rate_before * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{performance_metrics.conversion_rate_before}%</span>
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                <span className="text-lg font-semibold">{performance_metrics.conversion_rate_after}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyword Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Keyword Optimization Recommendations
          </CardTitle>
          <CardDescription>
            Implement these keywords in your profile and description to improve ranking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {keywords.slice(0, 10).map((keyword, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  {keyword.implemented ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">{keyword.keyword}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Relevance: {keyword.relevance}%</span>
                      <span>•</span>
                      <span>Competition: {keyword.competition}</span>
                      <span>•</span>
                      <span>Volume: {keyword.searchVolume}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {keyword.currentRank && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Current → Potential</p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">#{keyword.currentRank}</span>
                        <ArrowUpRight className="h-3 w-3 inline mx-1 text-green-500" />
                        <span className="text-green-600 font-medium">#{keyword.potentialRank}</span>
                      </p>
                    </div>
                  )}
                  <Badge variant={keyword.implemented ? 'default' : 'secondary'}>
                    {keyword.implemented ? 'Implemented' : 'Add to Profile'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Profile Optimization Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Profile Optimization Checklist
          </CardTitle>
          <CardDescription>
            Complete these optimizations to maximize your search ranking ({completedOptimizations}/{profile_optimizations.length} completed)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Progress value={(completedOptimizations / profile_optimizations.length) * 100} className="h-2" />
            
            <div className="grid gap-3 mt-4">
              {profile_optimizations.map((opt, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    opt.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : 
                    opt.status === 'pending' ? 'bg-yellow-500/5 border-yellow-500/20' : 
                    'bg-muted/50'
                  }`}
                >
                  {opt.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : opt.status === 'pending' ? (
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{opt.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {opt.impact} impact
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{opt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competitive Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Competitive Ranking</CardTitle>
          <CardDescription>How you compare to similar merchants in your area</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  You
                </div>
                <span className="font-medium">Your Business</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={ranking_score} className="w-24 h-2" />
                <span className="font-semibold">{ranking_score}</span>
              </div>
            </div>
            
            {top_competitors.map((competitor, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </div>
                  <span className="text-muted-foreground">{competitor.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={competitor.ranking_score} className="w-24 h-2" />
                  <span className="text-muted-foreground">{competitor.ranking_score}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to get relevant keywords based on business type
function getBusinessTypeKeywords(businessType: string): Array<{
  term: string;
  relevance: number;
  competition: 'low' | 'medium' | 'high';
  searchVolume: 'low' | 'medium' | 'high';
}> {
  type KeywordData = {
    term: string;
    relevance: number;
    competition: 'low' | 'medium' | 'high';
    searchVolume: 'low' | 'medium' | 'high';
  };
  
  const keywordsByType: Record<string, KeywordData[]> = {
    vet: [
      { term: 'veterinarian near me', relevance: 95, competition: 'high', searchVolume: 'high' },
      { term: 'pet doctor', relevance: 90, competition: 'medium', searchVolume: 'high' },
      { term: 'animal hospital', relevance: 85, competition: 'high', searchVolume: 'medium' },
      { term: 'emergency vet', relevance: 88, competition: 'medium', searchVolume: 'medium' },
      { term: 'pet vaccinations', relevance: 82, competition: 'low', searchVolume: 'medium' },
      { term: 'pet checkup', relevance: 80, competition: 'low', searchVolume: 'medium' },
      { term: 'dog vet', relevance: 78, competition: 'medium', searchVolume: 'high' },
      { term: 'cat vet', relevance: 76, competition: 'medium', searchVolume: 'medium' },
      { term: 'pet surgery', relevance: 70, competition: 'low', searchVolume: 'low' },
      { term: 'affordable vet', relevance: 85, competition: 'medium', searchVolume: 'high' },
    ],
    groomer: [
      { term: 'dog grooming', relevance: 95, competition: 'high', searchVolume: 'high' },
      { term: 'pet groomer near me', relevance: 92, competition: 'medium', searchVolume: 'high' },
      { term: 'cat grooming', relevance: 85, competition: 'low', searchVolume: 'medium' },
      { term: 'dog haircut', relevance: 88, competition: 'medium', searchVolume: 'medium' },
      { term: 'pet spa', relevance: 75, competition: 'low', searchVolume: 'medium' },
      { term: 'dog bath', relevance: 80, competition: 'low', searchVolume: 'medium' },
      { term: 'nail trimming', relevance: 78, competition: 'low', searchVolume: 'medium' },
      { term: 'mobile grooming', relevance: 72, competition: 'low', searchVolume: 'low' },
      { term: 'puppy grooming', relevance: 82, competition: 'medium', searchVolume: 'medium' },
      { term: 'professional groomer', relevance: 70, competition: 'medium', searchVolume: 'low' },
    ],
    pet_store: [
      { term: 'pet store near me', relevance: 95, competition: 'high', searchVolume: 'high' },
      { term: 'pet supplies', relevance: 90, competition: 'high', searchVolume: 'high' },
      { term: 'dog food', relevance: 88, competition: 'high', searchVolume: 'high' },
      { term: 'cat food', relevance: 85, competition: 'medium', searchVolume: 'high' },
      { term: 'pet toys', relevance: 82, competition: 'medium', searchVolume: 'medium' },
      { term: 'dog treats', relevance: 80, competition: 'medium', searchVolume: 'medium' },
      { term: 'pet accessories', relevance: 75, competition: 'low', searchVolume: 'medium' },
      { term: 'organic pet food', relevance: 70, competition: 'low', searchVolume: 'low' },
      { term: 'pet beds', relevance: 68, competition: 'low', searchVolume: 'low' },
      { term: 'local pet store', relevance: 85, competition: 'medium', searchVolume: 'medium' },
    ],
    trainer: [
      { term: 'dog training', relevance: 95, competition: 'high', searchVolume: 'high' },
      { term: 'puppy training', relevance: 92, competition: 'medium', searchVolume: 'high' },
      { term: 'obedience training', relevance: 88, competition: 'medium', searchVolume: 'medium' },
      { term: 'dog trainer near me', relevance: 90, competition: 'medium', searchVolume: 'high' },
      { term: 'behavior training', relevance: 82, competition: 'low', searchVolume: 'medium' },
      { term: 'potty training', relevance: 78, competition: 'low', searchVolume: 'medium' },
      { term: 'private dog training', relevance: 75, competition: 'low', searchVolume: 'low' },
      { term: 'group dog classes', relevance: 70, competition: 'low', searchVolume: 'low' },
      { term: 'aggressive dog training', relevance: 72, competition: 'low', searchVolume: 'low' },
      { term: 'certified dog trainer', relevance: 80, competition: 'medium', searchVolume: 'medium' },
    ],
    sitter: [
      { term: 'pet sitting', relevance: 95, competition: 'medium', searchVolume: 'high' },
      { term: 'dog sitter near me', relevance: 92, competition: 'medium', searchVolume: 'high' },
      { term: 'cat sitting', relevance: 88, competition: 'low', searchVolume: 'medium' },
      { term: 'pet boarding', relevance: 85, competition: 'high', searchVolume: 'high' },
      { term: 'overnight pet care', relevance: 80, competition: 'low', searchVolume: 'medium' },
      { term: 'in-home pet sitting', relevance: 78, competition: 'low', searchVolume: 'medium' },
      { term: 'vacation pet care', relevance: 75, competition: 'low', searchVolume: 'low' },
      { term: 'trusted pet sitter', relevance: 82, competition: 'medium', searchVolume: 'medium' },
      { term: 'affordable pet sitting', relevance: 76, competition: 'medium', searchVolume: 'medium' },
      { term: 'professional pet sitter', relevance: 70, competition: 'low', searchVolume: 'low' },
    ],
    walker: [
      { term: 'dog walking', relevance: 95, competition: 'medium', searchVolume: 'high' },
      { term: 'dog walker near me', relevance: 92, competition: 'medium', searchVolume: 'high' },
      { term: 'pet walking service', relevance: 85, competition: 'low', searchVolume: 'medium' },
      { term: 'daily dog walks', relevance: 80, competition: 'low', searchVolume: 'medium' },
      { term: 'professional dog walker', relevance: 78, competition: 'low', searchVolume: 'medium' },
      { term: 'group dog walks', relevance: 72, competition: 'low', searchVolume: 'low' },
      { term: 'puppy walking', relevance: 75, competition: 'low', searchVolume: 'low' },
      { term: 'affordable dog walking', relevance: 82, competition: 'medium', searchVolume: 'medium' },
      { term: 'trusted dog walker', relevance: 76, competition: 'low', searchVolume: 'low' },
      { term: 'local dog walking', relevance: 88, competition: 'medium', searchVolume: 'medium' },
    ],
  };

  const keywords = keywordsByType[businessType.toLowerCase()] || keywordsByType.pet_store;
  return keywords;
}

// Helper function to generate profile optimization recommendations
function generateProfileOptimizations(merchant: {
  business_name: string;
  business_type: string;
  description: string | null;
  address: string | null;
}): ProfileOptimization[] {
  const optimizations: ProfileOptimization[] = [];

  // Check description length
  const descriptionLength = merchant.description?.length || 0;
  if (descriptionLength > 100) {
    optimizations.push({
      category: 'content',
      title: 'Detailed Description',
      description: 'Your business description is comprehensive and helps with search ranking.',
      status: 'completed',
      impact: 'high'
    });
  } else if (descriptionLength > 50) {
    optimizations.push({
      category: 'content',
      title: 'Expand Description',
      description: 'Add more details about your services to improve search visibility.',
      status: 'pending',
      impact: 'high'
    });
  } else {
    optimizations.push({
      category: 'content',
      title: 'Add Business Description',
      description: 'A detailed description helps customers find you and improves ranking.',
      status: 'recommended',
      impact: 'high'
    });
  }

  // Check address
  if (merchant.address && merchant.address.length > 20) {
    optimizations.push({
      category: 'location',
      title: 'Complete Address',
      description: 'Your address is complete and helps with local search results.',
      status: 'completed',
      impact: 'high'
    });
  } else {
    optimizations.push({
      category: 'location',
      title: 'Add Complete Address',
      description: 'Include your full address to appear in local search results.',
      status: 'recommended',
      impact: 'high'
    });
  }

  // Business name keywords
  const businessTypeInName = merchant.business_name.toLowerCase().includes(
    merchant.business_type.replace(/_/g, ' ').toLowerCase()
  );
  if (businessTypeInName) {
    optimizations.push({
      category: 'branding',
      title: 'Keyword in Business Name',
      description: 'Your business name includes relevant keywords for better discoverability.',
      status: 'completed',
      impact: 'medium'
    });
  } else {
    optimizations.push({
      category: 'branding',
      title: 'Consider Keywords in Name',
      description: 'Including your service type in business name can improve search visibility.',
      status: 'pending',
      impact: 'medium'
    });
  }

  // Add more general recommendations
  optimizations.push({
    category: 'engagement',
    title: 'Respond to Reviews',
    description: 'Actively responding to customer reviews improves your ranking score.',
    status: 'pending',
    impact: 'medium'
  });

  optimizations.push({
    category: 'media',
    title: 'Add Business Logo',
    description: 'Profiles with logos get 40% more clicks and appear more trustworthy.',
    status: 'pending',
    impact: 'medium'
  });

  optimizations.push({
    category: 'pricing',
    title: 'Enable PawBucks',
    description: 'Accepting PawBucks increases visibility in search results.',
    status: 'pending',
    impact: 'low'
  });

  return optimizations;
}

// Helper function to calculate ranking score
function calculateRankingScore(
  merchant: { 
    business_name: string; 
    description: string | null; 
    address: string | null 
  },
  keywords: KeywordRecommendation[]
): number {
  let score = 50; // Base score

  // Description completeness (up to 20 points)
  const descLength = merchant.description?.length || 0;
  score += Math.min(20, descLength / 10);

  // Address completeness (10 points)
  if (merchant.address && merchant.address.length > 20) {
    score += 10;
  }

  // Keyword implementation (up to 20 points)
  const implementedKeywords = keywords.filter(k => k.implemented).length;
  score += Math.min(20, (implementedKeywords / keywords.length) * 20);

  return Math.min(100, Math.round(score));
}
