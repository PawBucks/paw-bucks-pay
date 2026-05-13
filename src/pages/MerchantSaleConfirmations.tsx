import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { MerchantSaleConfirmationsTab } from "@/components/merchant/MerchantSaleConfirmationsTab";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantSaleConfirmations() {
  const { merchantId, loading } = useMerchantContext();
  return (
    <>
      <SEO title="Sale Confirmations · Merchant Workspace" description="Confirm PawBucks customer sales for faster reward crediting" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader
          section="Dashboard"
          title="Sale Confirmations"
          subtitle="Confirm PawBucks customer sales for faster reward crediting"
        />
        <div className="p-4 md:p-6">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <MerchantSaleConfirmationsTab merchantId={merchantId} />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}