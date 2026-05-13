import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { MerchantPremiumServicesTab } from "@/components/merchant/MerchantPremiumServicesTab";
import { useMerchantActiveServices, SERVICE_NAMES } from "@/hooks/useMerchantServices";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantPremiumServices() {
  const navigate = useNavigate();
  const { merchantId, loading } = useMerchantContext();
  const { data: activeServices = [] } = useMerchantActiveServices(merchantId);
  const has = (name: string) => (activeServices as string[]).includes(name);

  return (
    <>
      <SEO title="Premium Services · Merchant Workspace" description="Manage premium services" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Catalog & Services" title="Premium Services" subtitle="Manage your active premium service dashboards" />
        <div className="p-4 md:p-6">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <MerchantPremiumServicesTab
              merchantId={merchantId}
              hasSponsored={has(SERVICE_NAMES.SPONSORED_PLACEMENT)}
              hasPremiumAd={has(SERVICE_NAMES.PREMIUM_AD)}
              hasFeaturedPartner={has(SERVICE_NAMES.FEATURED_PARTNER)}
              hasSearchBooster={has(SERVICE_NAMES.SEARCH_RANKING_BOOSTER)}
              hasProfileOptimization={has(SERVICE_NAMES.PROFILE_OPTIMIZATION)}
              hasReviewCampaign={has(SERVICE_NAMES.REVIEW_CAMPAIGN)}
              hasPrioritySupport={has(SERVICE_NAMES.PRIORITY_SUPPORT)}
              hasSpotlight={has(SERVICE_NAMES.MERCHANT_SPOTLIGHT)}
              hasPremiumAnalytics={has(SERVICE_NAMES.PREMIUM_ANALYTICS)}
              hasTrainingCourse={has(SERVICE_NAMES.TRAINING_COURSE)}
              hasCohortAnalysis={has(SERVICE_NAMES.COHORT_ANALYSIS)}
              hasDemandForecasting={has(SERVICE_NAMES.DEMAND_FORECASTING)}
              hasKeywordInsights={has(SERVICE_NAMES.KEYWORD_INSIGHTS)}
              hasStrategyConsultation={has(SERVICE_NAMES.STRATEGY_CONSULTATION)}
              hasPosApi={has(SERVICE_NAMES.POS_API_INTEGRATION)}
              onNavigate={navigate}
            />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}