import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BalanceAmount {
  amount: number;
  currency: string;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: number;
  created: number;
  method?: string;
  type?: string;
  description?: string | null;
}

interface Charge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  description: string | null;
  stripeFee: number;
  applicationFee: number;
  totalFees: number;
  netAmount: number;
}

interface RefundData {
  count: number;
  amount: number;
}

interface BreakdownData {
  directPaymentEarnings: number;
  directPaymentFees: number;
  directPaymentCount: number;
  transactionEarnings: number;
  transactionCashbackPawBucks: number;
  transactionRewardsPawBucks: number;
  transactionCount: number;
}

interface PayoutSchedule {
  interval: string;
  delay_days: number;
  weekly_anchor: string | null;
  monthly_anchor: number | null;
}

interface Dispute {
  id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string;
  created: number;
  chargeId: string | null;
}

interface DisputesSummary {
  total: number;
  open: number;
  totalAmount: number;
  disputes: Dispute[];
}

export interface EarningsData {
  connected: boolean;
  accountId?: string;
  balance: {
    available: BalanceAmount[];
    pending: BalanceAmount[];
  };
  payoutSchedule: PayoutSchedule | null;
  payoutsEnabled: boolean;
  estimatedNextArrival: number | null;
  payoutHistory: Payout[];
  recentCharges: Charge[];
  disputes: DisputesSummary;
  summary: {
    totalEarnings: number;
    totalFees: number;
    transactionCount: number;
    totalRewardsGiven: number;
    refunds: RefundData;
    breakdown: BreakdownData;
  };
  dashboardUrl: string | null;
}

export function useMerchantEarnings() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<EarningsData | null>(null);

  const fetchEarnings = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      
      const { data: earnings, error } = await supabase.functions.invoke("get-merchant-earnings");
      
      if (error) throw error;
      
      setData(earnings);
      if (showToast) toast.success("Earnings data refreshed");
    } catch (error) {
      console.error("Error fetching earnings:", error);
      if (showToast) toast.error("Failed to refresh earnings data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const formatCurrency = (amount: number, currency = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getAvailableBalance = () => {
    if (!data?.balance?.available) return 0;
    return data.balance.available.reduce((sum, b) => sum + b.amount, 0);
  };

  const getPendingBalance = () => {
    if (!data?.balance?.pending) return 0;
    return data.balance.pending.reduce((sum, b) => sum + b.amount, 0);
  };

  const formatPayoutSchedule = () => {
    if (!data?.payoutSchedule) return "Not configured";
    const s = data.payoutSchedule;
    if (s.interval === "daily") return `Daily (${s.delay_days}-day rolling delay)`;
    if (s.interval === "weekly") return `Weekly on ${s.weekly_anchor || "Monday"}s (${s.delay_days}-day delay)`;
    if (s.interval === "monthly") return `Monthly on the ${s.monthly_anchor || 1}${getOrdinalSuffix(s.monthly_anchor || 1)} (${s.delay_days}-day delay)`;
    return `${s.interval} (${s.delay_days}-day delay)`;
  };

  return {
    loading,
    refreshing,
    data,
    fetchEarnings,
    formatCurrency,
    getAvailableBalance,
    getPendingBalance,
    formatPayoutSchedule,
  };
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
