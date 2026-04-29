import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { Card, CardContent } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Sparkles, Store, TrendingUp } from"lucide-react";
import { ServicePerformanceDashboard } from"./ServicePerformanceDashboard";
import { SponsoredPlacementDashboard } from"./SponsoredPlacementDashboard";
import { FeaturedPartnerWidget } from"./FeaturedPartnerWidget";
import { SearchRankingBoosterWidget } from"./SearchRankingBoosterWidget";
import { ProfileOptimizationWidget } from"./ProfileOptimizationWidget";
import { ReviewCampaignWidget } from"./ReviewCampaignWidget";
import { PrioritySupportWidget } from"./PrioritySupportWidget";
import { MerchantSpotlightWidget } from"./MerchantSpotlightWidget";
import { PremiumAnalyticsDashboard } from"./PremiumAnalyticsDashboard";
import { TrainingCourseWidget } from"./TrainingCourseWidget";
import { CohortAnalysisReport } from"./CohortAnalysisReport";
import { DemandForecastingReport } from"./DemandForecastingReport";
import { KeywordPerformanceWidget } from"./KeywordPerformanceWidget";
import { StrategyConsultationWidget } from"./StrategyConsultationWidget";
import { PosApiWidget } from"./PosApiWidget";

type MerchantPremiumServicesTabProps = {
 merchantId: string;
 hasSponsored: boolean;
 hasPremiumAd: boolean;
 hasFeaturedPartner: boolean;
 hasSearchBooster: boolean;
 hasProfileOptimization: boolean;
 hasReviewCampaign: boolean;
 hasPrioritySupport: boolean;
 hasSpotlight: boolean;
 hasPremiumAnalytics: boolean;
 hasTrainingCourse: boolean;
 hasCohortAnalysis: boolean;
 hasDemandForecasting: boolean;
 hasKeywordInsights: boolean;
 hasStrategyConsultation: boolean;
 hasPosApi: boolean;
 onNavigate: (path: string) => void;
};

export function MerchantPremiumServicesTab({
 merchantId,
 hasSponsored,
 hasPremiumAd,
 hasFeaturedPartner,
 hasSearchBooster,
 hasProfileOptimization,
 hasReviewCampaign,
 hasPrioritySupport,
 hasSpotlight,
 hasPremiumAnalytics,
 hasTrainingCourse,
 hasCohortAnalysis,
 hasDemandForecasting,
 hasKeywordInsights,
 hasStrategyConsultation,
 hasPosApi,
 onNavigate,
}: MerchantPremiumServicesTabProps) {
 const hasPremiumServices = hasSponsored || hasPremiumAd || hasFeaturedPartner || hasSearchBooster || hasProfileOptimization || hasReviewCampaign || hasPrioritySupport || hasSpotlight || hasPremiumAnalytics || hasTrainingCourse || hasCohortAnalysis || hasDemandForecasting || hasKeywordInsights || hasStrategyConsultation || hasPosApi;

 if (!hasPremiumServices) {
 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-3xl font-bold">Premium Services</h2>
 <p className="text-muted-foreground">Boost your business with premium features</p>
 </div>

 <Card className="text-center py-12">
 <CardContent>
 <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
 <h3 className="text-xl font-semibold mb-2">No Active Premium Services</h3>
 <p className="text-muted-foreground mb-6 max-w-md mx-auto">
 Upgrade your business with premium services like sponsored placements, 
 featured partner status, and more.
 </p>
 <Button onClick={() => onNavigate('/merchant/market')}>
 <Store className="w-4 h-4 mr-2" />
 Browse Merchant Market
 </Button>
 </CardContent>
 </Card>
 </div>
 );
 }

 const getDefaultTab = () => {
 if (hasPremiumAnalytics) return"analytics";
 if (hasSponsored) return"sponsored";
 if (hasPremiumAd) return"premium-ad";
 if (hasFeaturedPartner) return"featured";
 if (hasSearchBooster) return"search";
 if (hasCohortAnalysis) return"cohorts";
 if (hasDemandForecasting) return"forecasting";
 if (hasKeywordInsights) return"keywords";
 if (hasStrategyConsultation) return"strategy";
 if (hasPosApi) return"pos-api";
 if (hasProfileOptimization) return"profile";
 if (hasReviewCampaign) return"reviews";
 if (hasPrioritySupport) return"support";
 if (hasTrainingCourse) return"training";
 return"spotlight";
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center gap-2">
 <Sparkles className="w-6 h-6 text-primary" />
 <div>
 <h2 className="text-3xl font-bold">Premium Services</h2>
 <p className="text-muted-foreground">Manage your active premium service dashboards</p>
 </div>
 </div>

 <Tabs defaultValue="roi" className="w-full">
 <TabsList className="mb-4 flex-wrap h-auto gap-1">
 <TabsTrigger value="roi">
 <TrendingUp className="h-4 w-4 mr-1" />
 ROI Overview
 </TabsTrigger>
 {hasPremiumAnalytics && (
 <TabsTrigger value="analytics">Premium Analytics</TabsTrigger>
 )}
 {hasSponsored && (
 <TabsTrigger value="sponsored">Sponsored Placement</TabsTrigger>
 )}
 {hasPremiumAd && (
 <TabsTrigger value="premium-ad">Premium Ad</TabsTrigger>
 )}
 {hasFeaturedPartner && (
 <TabsTrigger value="featured">Featured Partner</TabsTrigger>
 )}
 {hasSearchBooster && (
 <TabsTrigger value="search">Search Booster</TabsTrigger>
 )}
 {hasCohortAnalysis && (
 <TabsTrigger value="cohorts">Cohort Analysis</TabsTrigger>
 )}
 {hasDemandForecasting && (
 <TabsTrigger value="forecasting">Demand Forecasting</TabsTrigger>
 )}
 {hasKeywordInsights && (
 <TabsTrigger value="keywords">Keyword Insights</TabsTrigger>
 )}
 {hasStrategyConsultation && (
 <TabsTrigger value="strategy">Strategy</TabsTrigger>
 )}
 {hasPosApi && (
 <TabsTrigger value="pos-api">POS & API</TabsTrigger>
 )}
 {hasProfileOptimization && (
 <TabsTrigger value="profile">Profile Optimization</TabsTrigger>
 )}
 {hasReviewCampaign && (
 <TabsTrigger value="reviews">Review Campaign</TabsTrigger>
 )}
 {hasPrioritySupport && (
 <TabsTrigger value="support">Priority Support</TabsTrigger>
 )}
 {hasSpotlight && (
 <TabsTrigger value="spotlight">Spotlight</TabsTrigger>
 )}
 {hasTrainingCourse && (
 <TabsTrigger value="training">Training Course</TabsTrigger>
 )}
 </TabsList>
 
 {/* ROI Overview - always first */}
 <TabsContent value="roi">
 <ServicePerformanceDashboard merchantId={merchantId} />
 </TabsContent>

 {hasPremiumAnalytics && (
 <TabsContent value="analytics">
 <PremiumAnalyticsDashboard />
 </TabsContent>
 )}

 {hasSponsored && (
 <TabsContent value="sponsored">
 <SponsoredPlacementDashboard merchantId={merchantId} serviceType="sponsored" />
 </TabsContent>
 )}
 
 {hasPremiumAd && (
 <TabsContent value="premium-ad">
 <SponsoredPlacementDashboard merchantId={merchantId} serviceType="premium-ad" />
 </TabsContent>
 )}
 
 {hasFeaturedPartner && (
 <TabsContent value="featured">
 <FeaturedPartnerWidget />
 </TabsContent>
 )}
 
 {hasSearchBooster && (
 <TabsContent value="search">
 <SearchRankingBoosterWidget />
 </TabsContent>
 )}

 {hasCohortAnalysis && (
 <TabsContent value="cohorts">
 <CohortAnalysisReport />
 </TabsContent>
 )}

 {hasDemandForecasting && (
 <TabsContent value="forecasting">
 <DemandForecastingReport />
 </TabsContent>
 )}

 {hasKeywordInsights && (
 <TabsContent value="keywords">
 <KeywordPerformanceWidget />
 </TabsContent>
 )}

 {hasStrategyConsultation && (
 <TabsContent value="strategy">
 <StrategyConsultationWidget />
 </TabsContent>
 )}

 {hasPosApi && (
 <TabsContent value="pos-api">
 <PosApiWidget />
 </TabsContent>
 )}
 
 {hasProfileOptimization && (
 <TabsContent value="profile">
 <ProfileOptimizationWidget />
 </TabsContent>
 )}
 
 {hasReviewCampaign && (
 <TabsContent value="reviews">
 <ReviewCampaignWidget />
 </TabsContent>
 )}
 
 {hasPrioritySupport && (
 <TabsContent value="support">
 <PrioritySupportWidget />
 </TabsContent>
 )}
 
 {hasSpotlight && (
 <TabsContent value="spotlight">
 <MerchantSpotlightWidget />
 </TabsContent>
 )}
 
 {hasTrainingCourse && (
 <TabsContent value="training">
 <TrainingCourseWidget />
 </TabsContent>
 )}
 </Tabs>
 </div>
 );
}
