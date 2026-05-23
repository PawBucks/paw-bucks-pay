import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { PaymentDialogWithPawBucks } from "@/components/PaymentDialogWithPawBucks";

interface Merchant {
  id: string;
  business_name: string;
  description: string | null;
  logo_url: string | null;
  business_type: string;
  onboarding_complete: boolean;
  stripe_account_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  cashback_rate: number;
  accepts_pawbucks: boolean;
}

export default function DirectCheckout() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  // Amount/tip can be prefilled from SimplePay (`/pay?...`) so the user
  // doesn't have to retype it on this page.
  const prefilledAmount = (() => {
    const v = parseFloat(searchParams.get("amount") || "");
    return Number.isFinite(v) && v > 0 ? v : undefined;
  })();
  const prefilledTip = (() => {
    const v = parseFloat(searchParams.get("tip") || "");
    return Number.isFinite(v) && v > 0 ? v : undefined;
  })();

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!merchantId) return;
      try {
        const { data, error } = await supabase
          .from("merchants")
          .select(
            "id, business_name, description, logo_url, business_type, onboarding_complete, stripe_account_id, address, phone, email, cashback_rate, accepts_pawbucks"
          )
          .eq("id", merchantId)
          .single();
        if (error) throw error;
        setMerchant(data as Merchant);
      } catch (err) {
        console.error("Error fetching merchant:", err);
        toast.error("Merchant not found");
      } finally {
        setLoading(false);
      }
    };
    fetchMerchant();
  }, [merchantId]);

  // Redirect unauthenticated users to login, returning to /pay/:id afterward
  useEffect(() => {
    if (authLoading) return;
    if (!user && merchantId) {
      const redirectTo = encodeURIComponent(`/pay/${merchantId}${window.location.search}`);
      navigate(`/auth?redirect=${redirectTo}`, { replace: true });
    }
  }, [user, authLoading, merchantId, navigate]);

  // Auto-open the dialog once merchant + user are ready
  useEffect(() => {
    if (
      user &&
      merchant &&
      merchant.onboarding_complete &&
      merchant.stripe_account_id &&
      !success
    ) {
      setDialogOpen(true);
    }
  }, [user, merchant, success]);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SEO title="Payment Success" description="Your payment was successful" noIndex />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto text-primary mb-4" />
            <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you for your payment. PawBucks have been added to your wallet.
            </p>
            <Button onClick={() => navigate("/home")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Merchant not found</p>
            <Button className="mt-4" onClick={() => navigate("/discover")}>
              Browse Merchants
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!merchant.onboarding_complete || !merchant.stripe_account_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SEO title={`Pay ${merchant.business_name}`} noIndex />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">{merchant.business_name}</h2>
            <p className="text-muted-foreground">
              This merchant hasn't completed their payment setup yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <SEO
        title={`Pay ${merchant.business_name}`}
        description={`Make a payment to ${merchant.business_name}`}
        noIndex
      />

      {/*
        The PaymentDialogWithPawBucks already renders a branded header with
        logo / phone / address. Showing a duplicate merchant card behind the
        dialog created the impression of two checkout pages. We render only a
        light backdrop here and let the dialog handle the entire flow.
      */}
      {!dialogOpen && (
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <h1 className="text-xl font-semibold">{merchant.business_name}</h1>
            <p className="text-sm text-muted-foreground">Opening secure checkout…</p>
            <Button className="w-full" onClick={() => setDialogOpen(true)}>
              Open Checkout
            </Button>
          </CardContent>
        </Card>
      )}

      {user && (
        <PaymentDialogWithPawBucks
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          merchantId={merchant.id}
          merchantName={merchant.business_name}
          cashbackRate={merchant.cashback_rate}
          acceptsPawbucks={merchant.accepts_pawbucks}
          userId={user.id}
          initialAmount={prefilledAmount}
          initialTip={prefilledTip}
          onSuccess={() => {
            setDialogOpen(false);
            setSuccess(true);
          }}
        />
      )}
    </div>
  );
}
