import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function CheckInPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; entityName: string | null; message: string } | null>(null);
  const checkinAttempted = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Redirect to auth with return path
      navigate(`/auth?redirect=/checkin?token=${token}`);
      return;
    }

    if (!token) {
      navigate("/dashboard");
      return;
    }

    // Process check-in
    const doCheckin = async () => {
      if (checkinAttempted.current) return;
      checkinAttempted.current = true;
      setProcessing(true);
      try {
        const { data, error } = await supabase.rpc("process_checkin", {
          p_token: token,
          p_user_id: user.id,
        });

        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setResult({
            success: row.success,
            entityName: row.entity_name,
            message: row.message,
          });
          if (row.success) {
            toast.success(`Checked in at ${row.entity_name}!`);
            // Distribute branded PawBucks if merchant has active campaigns
            if (row.merchant_id || row.vet_id) {
              supabase.functions.invoke("distribute-branded-pawbucks", {
                body: {
                  user_id: user.id,
                  merchant_id: row.merchant_id || row.vet_id,
                  checkin_id: row.checkin_id,
                },
              }).then(({ data: brandedData }) => {
                if (brandedData?.distributed && brandedData.campaigns?.length > 0) {
                  const total = brandedData.total_amount;
                  const brandNames = brandedData.campaigns.map((c: any) => c.brand_name).join(", ");
                  toast.success(`🎁 You received ${total.toLocaleString()} branded PawBucks from ${brandNames}!`, { duration: 5000 });
                }
              }).catch(() => { /* silent - branded PB is a bonus */ });
            }
          }
        }
      } catch (error) {
        console.error("Check-in error:", error);
        setResult({ success: false, entityName: null, message: "Failed to process check-in" });
      } finally {
        setProcessing(false);
      }
    };

    doCheckin();
  }, [user, authLoading, token, navigate]);

  if (authLoading || processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SEO title="Checking In..." description="Processing your check-in" />
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">Processing your check-in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SEO title="Check In" description="Check in at a PawBucks partner location" />
      <GradientCard className="max-w-md w-full p-8 text-center space-y-6">
        {result ? (
          <>
            {result.success ? (
              <>
                <CheckCircle2 className="w-20 h-20 mx-auto text-green-500" />
                <div>
                  <h1 className="text-2xl font-bold">Checked In!</h1>
                  <p className="text-muted-foreground mt-2">
                    Welcome to {result.entityName}
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-20 h-20 mx-auto text-destructive" />
                <div>
                  <h1 className="text-2xl font-bold">
                    {result.entityName || "Check-In"}
                  </h1>
                  <p className="text-muted-foreground mt-2">{result.message}</p>
                </div>
              </>
            )}
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </>
        ) : !user ? (
          <>
            <LogIn className="w-20 h-20 mx-auto text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold">Sign In Required</h1>
              <p className="text-muted-foreground mt-2">
                Please sign in to check in at this location
              </p>
            </div>
            <Button onClick={() => navigate(`/auth?redirect=/checkin?token=${token}`)} className="w-full">
              Sign In
            </Button>
          </>
        ) : null}
      </GradientCard>
    </div>
  );
}
