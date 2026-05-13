import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { MerchantQuickActionsTab } from "@/components/merchant/MerchantQuickActionsTab";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantQuickActions() {
  const navigate = useNavigate();
  const { merchantId, hasStripeAccount, loading } = useMerchantContext();
  return (
    <>
      <SEO title="Quick Actions · Merchant Workspace" description="Access all merchant tools" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Catalog & Services" title="Quick Actions" subtitle="Access all merchant tools, products, and settings" />
        <div className="p-4 md:p-6">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <MerchantQuickActionsTab
              merchantId={merchantId}
              hasStripeAccount={hasStripeAccount}
              fundingEligible={false}
              daysActive={0}
              onRequestFunding={() => navigate("/merchant-dashboard")}
              onEditProfile={() => navigate("/merchant-dashboard")}
              onNavigate={navigate}
            />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}