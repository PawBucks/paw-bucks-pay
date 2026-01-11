import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Store } from "lucide-react";
import { SponsoredPlacementDashboard } from "./SponsoredPlacementDashboard";
import { FeaturedPartnerWidget } from "./FeaturedPartnerWidget";
import { SearchRankingBoosterWidget } from "./SearchRankingBoosterWidget";
import { ProfileOptimizationWidget } from "./ProfileOptimizationWidget";
import { ReviewCampaignWidget } from "./ReviewCampaignWidget";
import { PrioritySupportWidget } from "./PrioritySupportWidget";
import { MerchantSpotlightWidget } from "./MerchantSpotlightWidget";

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
  onNavigate,
}: MerchantPremiumServicesTabProps) {
  const hasPremiumServices = hasSponsored || hasPremiumAd || hasFeaturedPartner || hasSearchBooster || hasProfileOptimization || hasReviewCampaign || hasPrioritySupport || hasSpotlight;

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
    if (hasSponsored) return "sponsored";
    if (hasPremiumAd) return "premium-ad";
    if (hasFeaturedPartner) return "featured";
    if (hasSearchBooster) return "search";
    if (hasProfileOptimization) return "profile";
    if (hasReviewCampaign) return "reviews";
    if (hasPrioritySupport) return "support";
    return "spotlight";
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

      <Tabs defaultValue={getDefaultTab()} className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
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
        </TabsList>
        
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
      </Tabs>
    </div>
  );
}
