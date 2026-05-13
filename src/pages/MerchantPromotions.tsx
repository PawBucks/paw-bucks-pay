import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { PromotionInvitationsInbox } from "@/components/PromotionInvitationsInbox";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantPromotions() {
  const { merchantId, loading } = useMerchantContext();
  return (
    <>
      <SEO title="Promotions · Merchant Workspace" description="Platform promotion invitations" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Marketing" title="Promotions" subtitle="Review and respond to platform promotion invitations from PawBucks" />
        <div className="p-4 md:p-6">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <PromotionInvitationsInbox recipientType="merchant" recipientId={merchantId} />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}