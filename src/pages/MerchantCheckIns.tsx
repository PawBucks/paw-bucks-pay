import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { CheckInDashboard } from "@/components/checkin/CheckInDashboard";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantCheckIns() {
  const { merchantId, businessName, loading } = useMerchantContext();
  return (
    <>
      <SEO title="Check-Ins · Merchant Workspace" description="View customer check-ins and manage your QR code" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Dashboard" title="Check-Ins" subtitle="View customer check-ins and manage your QR code" />
        <div className="p-4 md:p-6">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <CheckInDashboard entityId={merchantId} entityType="merchant" entityName={businessName ?? ""} />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}