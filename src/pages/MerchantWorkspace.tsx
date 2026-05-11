import { MerchantWorkspaceLayout } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { WorkspaceOverview } from "@/components/merchant/workspace/WorkspaceOverview";
import { SEO } from "@/components/SEO";

export default function MerchantWorkspace() {
  return (
    <>
      <SEO title="Merchant Workspace · PawBucks" description="Track your PawBucks sales, rewards, and account settings." />
      <MerchantWorkspaceLayout>
        <WorkspaceOverview />
      </MerchantWorkspaceLayout>
    </>
  );
}