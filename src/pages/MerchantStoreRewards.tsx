import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ArrowLeft, Gift, Loader2, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Formatters } from "@/utils/formatters";
import {
  useMerchantStoreRewardsWallet,
  useMerchantStoreRewardsActivity,
} from "@/hooks/useMerchantStoreRewardsWallet";
import { Header } from "@/components/Header";

export default function MerchantStoreRewards() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [topupAmount, setTopupAmount] = useState<string>("100");
  const [submitting, setSubmitting] = useState(false);

  const { data: merchant } = useQuery({
    queryKey: ["merchant-by-user", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("merchants")
        .select("id, business_name, fee_model")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: hasService, isLoading: loadingService } = useQuery({
    queryKey: ["merchant-has-srp", merchant?.id],
    enabled: !!merchant?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("merchant_has_store_rewards_pro", {
        p_merchant_id: merchant!.id,
      });
      return Boolean(data);
    },
  });

  const { data: wallet, refetch: refetchWallet } = useMerchantStoreRewardsWallet(merchant?.id);
  const { data: activity = [], refetch: refetchActivity } = useMerchantStoreRewardsActivity(merchant?.id);

  // Refresh after returning from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      toast.success("Funding initiated — your balance will update shortly.");
      const t = setTimeout(() => {
        refetchWallet();
        refetchActivity();
      }, 2500);
      return () => clearTimeout(t);
    }
    if (params.get("topup") === "cancel") {
      toast.info("Funding canceled");
    }
  }, [refetchWallet, refetchActivity]);

  const handleTopup = async () => {
    if (!merchant?.id) return;
    const dollars = parseFloat(topupAmount);
    if (!Number.isFinite(dollars) || dollars < 10 || dollars > 5000) {
      toast.error("Enter an amount between $10 and $5,000");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("store-rewards-fund", {
        body: { merchantId: merchant.id, amountCents: Math.round(dollars * 100) },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start funding");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingService) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen p-6">
        <p>Merchant profile not found.</p>
      </div>
    );
  }

  if (!hasService) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-4xl mx-auto p-6">
          <Button variant="ghost" onClick={() => navigate("/merchant/market")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Merchant Market
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" aria-hidden="true" /> Store Rewards Pro
              </CardTitle>
              <CardDescription>
                Run your own in-store PawBucks cash back rewards program. Available to
                Acquisition-Only merchants.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                You don't have an active Store Rewards Pro subscription. Subscribe in the
                Merchant Market to start issuing in-store PawBucks to your customers.
              </p>
              <Button onClick={() => navigate("/merchant/market")}>
                Browse Merchant Market
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const balanceUsd = (wallet?.balance_cents ?? 0) / 100;
  const lifetimeFundedUsd = (wallet?.lifetime_funded_cents ?? 0) / 100;
  const lowBalanceUsd = (wallet?.low_balance_threshold_cents ?? 5000) / 100;
  const isLowBalance = balanceUsd <= lowBalanceUsd;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gift className="h-7 w-7 text-primary" aria-hidden="true" /> Store Rewards Pro
          </h1>
          <p className="text-muted-foreground">
            Issue in-store PawBucks to your customers — redeemable only at your business.
          </p>
        </div>

        {/* Funding balance */}
        <Card className={isLowBalance ? "border-destructive" : undefined}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" aria-hidden="true" /> Funding Balance
              </CardTitle>
              {isLowBalance && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Low balance
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">${Formatters.number(Math.round(balanceUsd * 100) / 100)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Each $1 funds 1,000 PawBucks (1 PB = $0.001) issued to your customers.
            </p>

            <Separator className="my-4" />

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Lifetime funded</p>
                <p className="font-semibold">${Formatters.number(lifetimeFundedUsd)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">PB issued</p>
                <p className="font-semibold">{Formatters.number(wallet?.lifetime_issued_pb ?? 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">PB redeemed</p>
                <p className="font-semibold">{Formatters.number(wallet?.lifetime_redeemed_pb ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top-up form */}
        <Card>
          <CardHeader>
            <CardTitle>Add Funds</CardTitle>
            <CardDescription>Top up via secure Stripe checkout (min $10, max $5,000).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {[50, 100, 250, 500].map((amt) => (
                <Button
                  key={amt}
                  variant={topupAmount === String(amt) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTopupAmount(String(amt))}
                >
                  ${amt}
                </Button>
              ))}
            </div>
            <div>
              <Label htmlFor="topup-amount">Custom amount (USD)</Label>
              <Input
                id="topup-amount"
                type="number"
                min={10}
                max={5000}
                step={1}
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
              />
            </div>
            <Button onClick={handleTopup} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Fund ${topupAmount || "0"}
            </Button>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" aria-hidden="true" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No funding activity yet. Add funds above to start issuing in-store rewards.
              </p>
            ) : (
              <div className="space-y-2">
                {activity.map((a) => {
                  const sign = a.amount_cents >= 0 ? "+" : "−";
                  const usd = Math.abs(a.amount_cents) / 100;
                  const positive = a.amount_cents >= 0;
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">{a.type.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.description ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("en-US", {
                            timeZone: "America/New_York",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={
                            "text-sm font-bold " +
                            (positive ? "text-emerald-600" : "text-destructive")
                          }
                        >
                          {sign}${Formatters.number(usd)}
                        </p>
                        {a.pb_amount && (
                          <p className="text-xs text-muted-foreground">
                            {Formatters.number(a.pb_amount)} PB
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}