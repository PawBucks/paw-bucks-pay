import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Loader2 } from "lucide-react";
import { MerchantMessagesTab } from "@/components/merchant/MerchantMessagesTab";
import { MerchantWorkspaceLayout, WorkspacePageHeader } from "@/components/merchant/workspace/MerchantWorkspaceLayout";

const MerchantMessages = () => {
 const { user, loading: authLoading } = useAuth();
 const [merchantId, setMerchantId] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!user || authLoading) return;
 const loadMerchant = async () => {
 const { data } = await supabase
 .from("merchants")
 .select("id")
 .eq("user_id", user.id)
 .eq("approval_status","approved")
 .maybeSingle();
 setMerchantId(data?.id || null);
 setLoading(false);
 };
 loadMerchant();
 }, [user, authLoading]);

 return (
   <>
     <SEO title="Messages · Merchant Workspace" description="Communicate with your customers" />
     <MerchantWorkspaceLayout>
       <WorkspacePageHeader section="Marketing" title="Customer Messages" subtitle="Communicate with your customers" />
       <div className="p-4 md:p-6">
         {authLoading || loading ? (
           <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
         ) : !merchantId ? (
           <p className="text-muted-foreground text-center py-16">Merchant account not found.</p>
         ) : (
           <MerchantMessagesTab merchantId={merchantId} />
         )}
       </div>
     </MerchantWorkspaceLayout>
   </>
 );
};

export default MerchantMessages;
