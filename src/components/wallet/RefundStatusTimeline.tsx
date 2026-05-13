import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, RotateCcw, Wallet as WalletIcon, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GradientCard } from "@/components/ui/gradient-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Formatters } from "@/utils/formatters";
import { PawBucksLogo } from "@/components/PawBucksLogo";

type RefundedTxn = {
  id: string;
  amount: number;
  amount_refunded: number | null;
  pawbucks_refunded: number | null;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
};

type RefundActivity = {
  id: string;
  amount: number;
  description: string | null;
  created_at: string;
};

interface Props {
  userId: string;
  currentBalance: number;
}

/**
 * RefundStatusTimeline
 *
 * Surfaces a clear, in-app confirmation of recent refunds for the current user:
 *   1. Refund initiated by the merchant
 *   2. PawBucks credited back to the wallet
 *   3. Wallet balance updated (with the corrected balance shown)
 *
 * Only renders when the user has at least one refunded / partially_refunded
 * transaction in the last 60 days.
 */
export function RefundStatusTimeline({ userId, currentBalance }: Props) {
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<RefundedTxn[]>([]);
  const [refundCredits, setRefundCredits] = useState<RefundActivity[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const [txnRes, actRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, amount, amount_refunded, pawbucks_refunded, status, description, created_at, updated_at")
          .eq("user_id", userId)
          .in("status", ["refunded", "partially_refunded"])
          .gte("created_at", sixtyDaysAgo)
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("pawbucks_activity")
          .select("id, amount, description, created_at")
          .eq("user_id", userId)
          .eq("source", "refund")
          .eq("type", "earn")
          .gte("created_at", sixtyDaysAgo)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;
      setRefunds((txnRes.data as RefundedTxn[]) || []);
      setRefundCredits((actRes.data as RefundActivity[]) || []);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <GradientCard className="mb-6">
        <Skeleton className="h-32 w-full" />
      </GradientCard>
    );
  }

  if (refunds.length === 0) return null;

  return (
    <div className="mb-8 space-y-4">
      {refunds.map((txn) => {
        // Match the credit activity for this refund (by amount or recency).
        const expectedPb = txn.pawbucks_refunded ?? 0;
        const credit =
          refundCredits.find((c) => c.amount === expectedPb && new Date(c.created_at) >= new Date(txn.created_at)) ||
          refundCredits.find((c) => c.description?.toLowerCase().includes((txn.description || "").toLowerCase().split(" ")[0] || "___"));

        const refundedAt = txn.updated_at || credit?.created_at || txn.created_at;
        const creditedAt = credit?.created_at || refundedAt;
        const isPartial =
          txn.status === "partially_refunded" ||
          (Number(txn.amount_refunded ?? 0) > 0 && Number(txn.amount_refunded ?? 0) < Number(txn.amount));

        return (
          <GradientCard
            key={txn.id}
            className="border-success/30 bg-gradient-to-br from-success/5 via-background to-background"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Refund processed</h3>
                  <p className="text-xs text-muted-foreground">
                    {txn.description || "Transaction"}
                  </p>
                </div>
              </div>
              <Badge variant={isPartial ? "secondary" : "default"} className="shrink-0">
                {isPartial ? "Partial" : "Complete"}
              </Badge>
            </div>

            {/* Amount summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                <p className="text-xs text-muted-foreground">Refunded</p>
                <p className="text-xl font-bold text-success">
                  {Formatters.currency(Number(txn.amount_refunded ?? txn.amount))}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-card/60 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <PawBucksLogo className="w-3 h-3" /> PawBucks returned
                </p>
                <p className="text-xl font-bold">
                  +{Formatters.number(expectedPb)}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <ol className="relative border-l-2 border-success/30 ml-3 space-y-5">
              <TimelineStep
                icon={<Receipt className="w-4 h-4" />}
                title="Refund initiated"
                detail={`Merchant issued the refund`}
                timestamp={refundedAt}
                done
              />
              <TimelineStep
                icon={<PawBucksLogo className="w-4 h-4" />}
                title="PawBucks credited to wallet"
                detail={`+${Formatters.number(expectedPb)} PawBucks (${Formatters.currency(
                  expectedPb * 0.001,
                )})`}
                timestamp={creditedAt}
                done
              />
              <TimelineStep
                icon={<CheckCircle2 className="w-4 h-4" />}
                title="Wallet balance updated"
                detail={
                  <span>
                    New balance:{" "}
                    <span className="font-semibold text-foreground">
                      {Formatters.number(currentBalance)} PawBucks
                    </span>{" "}
                    <span className="text-success">({Formatters.currency(currentBalance * 0.001)})</span>
                  </span>
                }
                timestamp={creditedAt}
                done
                highlight
              />
            </ol>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <WalletIcon className="w-3.5 h-3.5" />
              <span>Funds are immediately available to spend at any PawBucks merchant.</span>
            </div>
          </GradientCard>
        );
      })}
    </div>
  );
}

function TimelineStep({
  icon,
  title,
  detail,
  timestamp,
  done,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  detail: React.ReactNode;
  timestamp: string;
  done?: boolean;
  highlight?: boolean;
}) {
  return (
    <li className="ml-4">
      <span
        className={`absolute -left-[13px] flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-background ${
          done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <div className={`pl-2 ${highlight ? "rounded-md bg-success/10 p-2 -ml-2" : ""}`}>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </li>
  );
}