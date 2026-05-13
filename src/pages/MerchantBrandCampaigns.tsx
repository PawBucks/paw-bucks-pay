import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { MerchantBrandCampaignInbox } from "@/components/merchant/MerchantBrandCampaignInbox";
import { AvailableBrandCampaigns } from "@/components/merchant/AvailableBrandCampaigns";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantBrandCampaigns() {
  const { merchantId, loading } = useMerchantContext();
  return (
    <>
      <SEO title="Brand Campaigns · Merchant Workspace" description="Brand campaign invitations" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Marketing" title="Brand Campaigns" subtitle="Review and respond to brand campaign invitations" />
        <div className="p-4 md:p-6 space-y-4">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <MerchantBrandCampaignInbox merchantId={merchantId} />
              <AvailableBrandCampaigns merchantId={merchantId} />
            </>
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}