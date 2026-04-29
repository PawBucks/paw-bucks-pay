import { useEffect, useState } from"react";
import { useNavigate } from"react-router-dom";
import { useAuth } from"@/hooks/useAuth";
import { supabase } from"@/integrations/supabase/client";
import { SEO } from"@/components/SEO";
import { Button } from"@/components/ui/button";
import { Loader2, ArrowLeft } from"lucide-react";
import { MerchantMessagesTab } from"@/components/merchant/MerchantMessagesTab";

const MerchantMessages = () => {
 const { user, loading: authLoading } = useAuth();
 const navigate = useNavigate();
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

 if (authLoading || loading) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <Loader2 className="w-6 h-6 animate-spin" />
 </div>
 );
 }

 if (!merchantId) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <p className="text-muted-foreground">Merchant account not found.</p>
 </div>
 );
 }

 return (
 <>
 <SEO title="Messages | Merchant Dashboard" description="Communicate with your customers" />
 <div className="min-h-screen bg-background">
 <div className="container max-w-6xl mx-auto px-4 py-6">
 <div className="flex items-center gap-3 mb-6">
 <Button variant="ghost" size="icon" onClick={() => navigate("/merchant-dashboard")}>
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <h1 className="text-2xl font-bold">Customer Messages</h1>
 </div>
 <MerchantMessagesTab merchantId={merchantId} />
 </div>
 </div>
 </>
 );
};

export default MerchantMessages;
