import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";
import { SupportTab } from "@/components/support/SupportTab";
import { Loader2 } from "lucide-react";

export default function MerchantSupport() {
  const { user, loading: authLoading } = useAuth();
  const [merchantId, setMerchantId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || authLoading) return;
    supabase
      .from("merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMerchantId(data?.id);
        setLoading(false);
      });
  }, [user, authLoading]);

  return (
    <>
      <SEO title="Support · Merchant Workspace" description="Submit and track support tickets" />
      <MerchantWorkspaceLayout>
        <WorkspacePageHeader title="Support Center" section="Support" subtitle="Submit a ticket or track existing ones" />
        <div className="p-4 md:p-6">
          {authLoading || loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <SupportTab submitterType="merchant" entityId={merchantId} />
          )}
        </div>
      </MerchantWorkspaceLayout>
    </>
  );
}
