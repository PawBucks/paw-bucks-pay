import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { SalesReportGenerator } from "@/components/shared/SalesReportGenerator";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Loader2 } from "lucide-react";

export default function MerchantSalesReport() {
  const { merchantId, businessName, loading } = useMerchantContext();
  return (
    <>
      <SEO title="Sales Report · Merchant Workspace" description="Generate and download detailed sales reports" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader section="Dashboard" title="Sales Report" subtitle="Generate and download detailed sales reports" />
        <div className="p-4 md:p-6">
          {loading || !merchantId ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <SalesReportGenerator entityId={merchantId} entityType="merchant" entityName={businessName ?? ""} />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}