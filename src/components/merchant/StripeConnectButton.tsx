import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, CheckCircle2, AlertCircle, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StripeConnectButtonProps {
  onStatusChange?: (status: { connected: boolean; onboardingComplete: boolean }) => void;
}

export function StripeConnectButton({ onStatusChange }: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<{
    connected: boolean;
    onboardingComplete: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
  } | null>(null);

  const checkStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-connect-status");
      
      if (error) throw error;
      
      setStatus(data);
      onStatusChange?.(data);
    } catch (error) {
      console.error("Error checking Stripe status:", error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Check for return from Stripe onboarding
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("stripe_return") === "true") {
      toast.info("Verifying your Stripe account status...");
      checkStatus();
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (urlParams.get("stripe_refresh") === "true") {
      toast.info("Let's continue setting up your Stripe account");
      handleConnect();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Use the new Express Connect account function
      const { data, error } = await supabase.functions.invoke("create-express-connect-account");
      
      if (error) throw error;
      
      if (data.onboardingComplete) {
        toast.success("Your Stripe account is already connected!");
        setStatus({ connected: true, onboardingComplete: true });
        onStatusChange?.({ connected: true, onboardingComplete: true });
      } else if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      toast.error("Failed to start Stripe onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (status?.onboardingComplete) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Stripe Connected
            </CardTitle>
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              Active
            </Badge>
          </div>
          <CardDescription>
            Your Stripe account is connected and ready to accept payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={checkStatus} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status?.connected && !status.onboardingComplete) {
    return (
      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Complete Setup
            </CardTitle>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
              Pending
            </Badge>
          </div>
          <CardDescription>
            Your Stripe account needs additional information before you can accept payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnect} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Continue Setup
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Connect Stripe
        </CardTitle>
        <CardDescription>
          Connect your Stripe account to receive payments directly from customers. 
          Stripe-hosted onboarding makes setup quick and easy, with a 3% network fee.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleConnect} disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ExternalLink className="h-4 w-4 mr-2" />
          )}
          Connect Stripe Account
        </Button>
      </CardContent>
    </Card>
  );
}
