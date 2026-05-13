import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { MerchantLoyaltyProgramTab } from "@/components/merchant/MerchantLoyaltyProgramTab";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantLoyalty() {
  const { merchantId, loading } = useMerchantContext();
  return (
    <>
      <SEO title="Loyalty Program · Merchant Workspace" description="Punch card loyalty programs" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Catalog & Services" title="Loyalty Program" subtitle="Create and manage punch card loyalty programs for your customers" />
        <div className="p-4 md:p-6">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <MerchantLoyaltyProgramTab merchantId={merchantId} />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}