import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Formatters } from "@/utils/formatters";
import { format } from "date-fns";
import { ChevronDown, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { TransactionItemsPanel } from "@/components/transactions/TransactionItemsPanel";

const PB_TO_USD = 0.001;

type ActivityRow = {
  id: string;
  amount: number;
  cashback_earned: number;
  pawbucks_used: number;
  stripe_amount: number | null;
  application_fee: number | null;
  payment_method: string | null;
  description: string | null;
  amount_refunded: number;
  pawbucks_refunded: number;
  status: string;
  created_at: string;
  merchant_id: string | null;
  merchant_name: string | null;
};

const Activity = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: activities, isLoading } = useQuery({
    queryKey: ["pet-owner-activity", user?.id],
    queryFn: async (): Promise<ActivityRow[]> => {
      if (!user?.id) return [];
      const { data: txs } = await supabase
        .from("transactions")
        .select(
          "id, amount, cashback_earned, pawbucks_used, stripe_amount, application_fee, payment_method, description, amount_refunded, pawbucks_refunded, status, created_at, merchant_id",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = txs ?? [];
      const ids = Array.from(
        new Set(rows.map((r: any) => r.merchant_id).filter(Boolean)),
      );
      let nameById = new Map<string, string>();
      if (ids.length) {
        const { data: merchants } = await supabase
          .from("merchants_public")
          .select("id, business_name")
          .in("id", ids);
        nameById = new Map(
          (merchants ?? []).map((m: any) => [m.id, m.business_name]),
        );
      }
      return rows.map((r: any) => ({
        ...r,
        merchant_name: r.merchant_id ? nameById.get(r.merchant_id) ?? null : null,
      }));
    },
    enabled: !!user?.id,
  });

  const totals = useMemo(() => {
    const list = activities ?? [];
    let totalSpent = 0;
    let totalSaved = 0;
    for (const v of list) {
      // Out-of-pocket cash only (PawBucks redemptions are savings, not spend).
      const cashPaid = Math.max(
        0,
        Number(v.stripe_amount ?? 0) - Number(v.amount_refunded ?? 0),
      );
      totalSpent += cashPaid;
      const earnedUsd = Number(v.cashback_earned ?? 0) * PB_TO_USD;
      const redeemedUsd = Number(v.pawbucks_used ?? 0) * PB_TO_USD;
      const refundedUsd = Number(v.pawbucks_refunded ?? 0) * PB_TO_USD;
      totalSaved += earnedUsd + Math.max(0, redeemedUsd - refundedUsd);
    }
    return { totalSpent, totalSaved, count: list.length };
  }, [activities]);

  return (
    <>
      <SEO title="Your activity — PawBucks" noIndex />
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <Header isAuthenticated onLogout={signOut} userId={user?.id} />

        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-12 pb-28 md:pb-10 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-4xl font-semibold tracking-tight">
                Your activity
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Every penny you've spent — and every penny you've saved.
              </p>
            </div>
            <Button
              onClick={() => navigate("/my-deals")}
              variant="outline"
              size="sm"
              className="sm:self-end border-accent/30 text-accent hover:bg-accent/5 hover:text-accent shrink-0"
            >
              🎁 My New Customer Deals
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <TrendingDown className="h-3.5 w-3.5" /> Lifetime spent
              </div>
              <p className="text-2xl lg:text-3xl font-semibold mt-1">
                {Formatters.currency(totals.totalSpent)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                across {totals.count} {totals.count === 1 ? "transaction" : "transactions"}
              </p>
            </Card>
            <Card className="p-4 border-success/30 bg-success/5">
              <div className="flex items-center gap-2 text-xs text-success uppercase tracking-wider">
                <TrendingUp className="h-3.5 w-3.5" /> Lifetime saved
              </div>
              <p className="text-2xl lg:text-3xl font-semibold mt-1 text-success">
                {Formatters.currency(totals.totalSaved)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                earned + redeemed PawBucks
              </p>
            </Card>
          </div>

          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Loading your activity…
            </div>
          ) : !activities || activities.length === 0 ? (
            <Card className="p-8 text-center">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h2 className="text-base font-medium mb-1">No activity yet</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Pay a pet care place through PawBucks to start tracking activity.
              </p>
              <Button onClick={() => navigate("/pay")}>Make a payment</Button>
            </Card>
          ) : (
            <ul className="space-y-2">
              {activities.map((v) => {
                const paid = Number(v.amount ?? 0);
                const refunded = Number(v.amount_refunded ?? 0);
                const net = paid - refunded;
                const earnedUsd = Number(v.cashback_earned ?? 0) * PB_TO_USD;
                const redeemedUsd = Number(v.pawbucks_used ?? 0) * PB_TO_USD;
                const redeemedRefundUsd =
                  Number(v.pawbucks_refunded ?? 0) * PB_TO_USD;
                const cashUsd = Number(v.stripe_amount ?? 0);
                const savedThisVisit =
                  earnedUsd + Math.max(0, redeemedUsd - redeemedRefundUsd);
                const isOpen = openId === v.id;
                return (
                  <li key={v.id}>
                    <Collapsible
                      open={isOpen}
                      onOpenChange={(o) => setOpenId(o ? v.id : null)}
                    >
                      <Card className="overflow-hidden">
                        <CollapsibleTrigger className="w-full text-left">
                          <div className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">
                                  {v.merchant_name ?? "Pet care"}
                                </p>
                                {v.status !== "completed" && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {v.status}
                                  </Badge>
                                )}
                                {refunded > 0 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    refund
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(v.created_at), "MMM d, yyyy · h:mm a")}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold">
                                {Formatters.currency(Math.max(0, cashUsd - refunded))}
                              </p>
                              {savedThisVisit > 0 && (
                                <p className="text-xs text-success font-medium">
                                  saved {Formatters.currency(savedThisVisit)}
                                </p>
                              )}
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 text-muted-foreground transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-1 border-t border-border/50 bg-muted/20">
                            {v.description && (
                              <p className="text-xs text-muted-foreground mb-3">
                                {v.description}
                              </p>
                            )}
                            {isOpen && (
                              <TransactionItemsPanel transactionId={v.id} className="mb-3" />
                            )}
                            <dl className="text-sm space-y-1.5">
                              <Row label="Visit total" value={Formatters.currency(paid)} />
                              {redeemedUsd > 0 && (
                                <Row
                                  label="PawBucks applied"
                                  value={`− ${Formatters.currency(redeemedUsd)}`}
                                  emphasis="success"
                                />
                              )}
                              {cashUsd > 0 && (
                                <Row
                                  label={`Paid by ${v.payment_method ?? "card"}`}
                                  value={Formatters.currency(cashUsd)}
                                />
                              )}
                              {refunded > 0 && (
                                <Row
                                  label="Refunded"
                                  value={`− ${Formatters.currency(refunded)}`}
                                  emphasis="warn"
                                />
                              )}
                              <div className="h-px bg-border my-2" />
                              <Row
                                label="PawBucks earned"
                                value={`+ ${Formatters.currency(earnedUsd)}`}
                                emphasis="success"
                              />
                              <Row
                                label="Net out of pocket"
                                value={Formatters.currency(cashUsd || net)}
                                strong
                              />
                            </dl>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  </li>
                );
              })}
            </ul>
          )}
        </main>

        <BottomNav />
      </div>
    </>
  );
};

const Row = ({
  label,
  value,
  emphasis,
  muted,
  strong,
}: {
  label: string;
  value: string;
  emphasis?: "success" | "warn";
  muted?: boolean;
  strong?: boolean;
}) => (
  <div className="flex items-center justify-between">
    <dt className={muted ? "text-xs text-muted-foreground" : "text-muted-foreground"}>
      {label}
    </dt>
    <dd
      className={[
        strong ? "font-semibold" : "",
        emphasis === "success" ? "text-success font-medium" : "",
        emphasis === "warn" ? "text-warning font-medium" : "",
        muted ? "text-xs text-muted-foreground" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {value}
    </dd>
  </div>
);

export default Activity;
