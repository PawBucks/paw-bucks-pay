import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { MerchantSubscribersTab } from "@/components/merchant/MerchantSubscribersTab";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantSubscribers() {
  const { merchantId, loading } = useMerchantContext();
  return (
    <>
      <SEO title="Subscribers · Merchant Workspace" description="View all active subscribers and their plans" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Dashboard" title="Subscribers" subtitle="View all active subscribers and their subscription plans" />
        <div className="p-4 md:p-6">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <MerchantSubscribersTab merchantId={merchantId} />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}