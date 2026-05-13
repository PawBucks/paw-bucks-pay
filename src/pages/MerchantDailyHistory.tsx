import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { MerchantDailySummaryTab } from "@/components/merchant/MerchantDailySummaryTab";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantDailyHistory() {
  const { merchantId, businessName, loading } = useMerchantContext();
  return (
    <>
      <SEO title="Daily History · Merchant Workspace" description="Daily settlement summaries" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Dashboard" title="Daily History" subtitle="Daily settlement summaries for reconciliation and tax purposes" />
        <div className="p-4 md:p-6">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <MerchantDailySummaryTab merchantId={merchantId} merchantName={businessName ?? ""} />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}